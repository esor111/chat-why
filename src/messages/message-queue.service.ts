import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { Message } from '../database/entities/message.entity';

export interface QueuedMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  deliveryAttempts: number;
}

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly maxDeliveryAttempts: number;
  private readonly messageRetentionHours: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.maxDeliveryAttempts = this.configService.get<number>('MESSAGE_MAX_DELIVERY_ATTEMPTS', 3);
    this.messageRetentionHours = this.configService.get<number>('MESSAGE_QUEUE_RETENTION_HOURS', 72);
  }

  /**
   * Queue message for offline user
   */
  async queueMessage(userId: string, message: Message): Promise<void> {
    try {
      const queuedMessage: QueuedMessage = {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        timestamp: message.createdAt,
        deliveryAttempts: 0,
      };

      const key = `message_queue:${userId}`;
      const score = message.createdAt.getTime();

      // Add to sorted set with timestamp as score for chronological ordering
      await this.redis.zadd(key, score, JSON.stringify(queuedMessage));

      // Set expiration for the entire queue key
      await this.redis.expire(key, this.messageRetentionHours * 3600);

      this.logger.debug(`Queued message ${message.id} for offline user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue message for user ${userId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Get queued messages for user (when they come online)
   */
  async getQueuedMessages(userId: string, limit: number = 100): Promise<QueuedMessage[]> {
    try {
      const key = `message_queue:${userId}`;
      
      // Get messages in chronological order
      const messages = await this.redis.zrange(key, 0, limit - 1);
      
      const queuedMessages: QueuedMessage[] = [];
      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr) as QueuedMessage;
          queuedMessages.push(message);
        } catch (parseError) {
          this.logger.warn(`Failed to parse queued message: ${parseError.message}`);
        }
      }

      this.logger.debug(`Retrieved ${queuedMessages.length} queued messages for user ${userId}`);
      return queuedMessages;
    } catch (error) {
      this.logger.error(`Failed to get queued messages for user ${userId}: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Mark message as delivered and remove from queue
   */
  async markAsDelivered(userId: string, messageId: string): Promise<void> {
    try {
      const key = `message_queue:${userId}`;
      
      // Get all messages to find the one to remove
      const messages = await this.redis.zrange(key, 0, -1);
      
      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr) as QueuedMessage;
          if (message.messageId === messageId) {
            await this.redis.zrem(key, messageStr);
            this.logger.debug(`Marked message ${messageId} as delivered for user ${userId}`);
            break;
          }
        } catch (parseError) {
          this.logger.warn(`Failed to parse message during delivery confirmation: ${parseError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to mark message as delivered for user ${userId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Increment delivery attempt count
   */
  async incrementDeliveryAttempt(userId: string, messageId: string): Promise<boolean> {
    try {
      const key = `message_queue:${userId}`;
      const messages = await this.redis.zrange(key, 0, -1, 'WITHSCORES');
      
      for (let i = 0; i < messages.length; i += 2) {
        const messageStr = messages[i];
        const score = parseFloat(messages[i + 1]);
        
        try {
          const message = JSON.parse(messageStr) as QueuedMessage;
          if (message.messageId === messageId) {
            message.deliveryAttempts++;
            
            if (message.deliveryAttempts >= this.maxDeliveryAttempts) {
              // Remove message after max attempts
              await this.redis.zrem(key, messageStr);
              this.logger.warn(`Removed message ${messageId} after ${this.maxDeliveryAttempts} failed delivery attempts`);
              return false;
            } else {
              // Update message with incremented attempt count
              await this.redis.zrem(key, messageStr);
              await this.redis.zadd(key, score, JSON.stringify(message));
              this.logger.debug(`Incremented delivery attempt for message ${messageId} (attempt ${message.deliveryAttempts})`);
              return true;
            }
          }
        } catch (parseError) {
          this.logger.warn(`Failed to parse message during attempt increment: ${parseError.message}`);
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to increment delivery attempt for message ${messageId}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Clear all queued messages for a user
   */
  async clearQueue(userId: string): Promise<void> {
    try {
      const key = `message_queue:${userId}`;
      await this.redis.del(key);
      this.logger.debug(`Cleared message queue for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to clear queue for user ${userId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Get queue size for a user
   */
  async getQueueSize(userId: string): Promise<number> {
    try {
      const key = `message_queue:${userId}`;
      return await this.redis.zcard(key);
    } catch (error) {
      this.logger.error(`Failed to get queue size for user ${userId}: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Get messages queued after a specific timestamp
   */
  async getQueuedMessagesAfter(userId: string, afterTimestamp: Date, limit: number = 50): Promise<QueuedMessage[]> {
    try {
      const key = `message_queue:${userId}`;
      const minScore = afterTimestamp.getTime();
      
      // Get messages after the specified timestamp
      const messages = await this.redis.zrangebyscore(key, minScore, '+inf', 'LIMIT', 0, limit);
      
      const queuedMessages: QueuedMessage[] = [];
      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr) as QueuedMessage;
          queuedMessages.push(message);
        } catch (parseError) {
          this.logger.warn(`Failed to parse queued message: ${parseError.message}`);
        }
      }

      return queuedMessages;
    } catch (error) {
      this.logger.error(`Failed to get queued messages after timestamp for user ${userId}: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Cleanup expired message queues (run periodically)
   */
  async cleanupExpiredQueues(): Promise<void> {
    try {
      const pattern = 'message_queue:*';
      const keys = await this.redis.keys(pattern);
      
      let cleanedCount = 0;
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key exists but has no expiration, set it
          await this.redis.expire(key, this.messageRetentionHours * 3600);
        } else if (ttl === -2) {
          // Key doesn't exist (already expired)
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired message queues`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup expired queues: ${error.message}`, error.stack);
    }
  }
}