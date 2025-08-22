import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';

export interface TypingIndicator {
  userId: string;
  conversationId: string;
  startedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TypingService {
  private readonly logger = new Logger(TypingService.name);
  private readonly typingTimeout: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.typingTimeout = this.configService.get<number>('TYPING_TIMEOUT', 5); // 5 seconds
  }

  /**
   * Start typing indicator for a user in a conversation
   */
  async startTyping(userId: string, conversationId: string): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.typingTimeout * 1000);
      


      const key = `typing:${conversationId}:${userId}`;
      await this.redis.hset(key, {
        userId,
        conversationId,
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      // Set expiration for auto-cleanup
      await this.redis.expire(key, this.typingTimeout);

      this.logger.debug(`User ${userId} started typing in conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to start typing indicator: ${error.message}`, error.stack);
    }
  }

  /**
   * Stop typing indicator for a user in a conversation
   */
  async stopTyping(userId: string, conversationId: string): Promise<void> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      await this.redis.del(key);

      this.logger.debug(`User ${userId} stopped typing in conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to stop typing indicator: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all users currently typing in a conversation
   */
  async getTypingUsers(conversationId: string): Promise<string[]> {
    try {
      const pattern = `typing:${conversationId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const typingUsers: string[] = [];
      const now = Date.now();

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        
        if (data && data.userId && data.expiresAt) {
          const expiresAt = new Date(data.expiresAt).getTime();
          
          // Check if typing indicator is still valid
          if (now < expiresAt) {
            typingUsers.push(data.userId);
          } else {
            // Clean up expired indicator
            await this.redis.del(key);
          }
        }
      }

      return typingUsers;
    } catch (error) {
      this.logger.error(`Failed to get typing users: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Check if a specific user is typing in a conversation
   */
  async isUserTyping(userId: string, conversationId: string): Promise<boolean> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      const data = await this.redis.hgetall(key);
      
      if (!data || !data.expiresAt) {
        return false;
      }

      const expiresAt = new Date(data.expiresAt).getTime();
      const now = Date.now();

      if (now >= expiresAt) {
        // Clean up expired indicator
        await this.redis.del(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to check if user is typing: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get typing indicators for multiple conversations
   */
  async getBulkTypingUsers(conversationIds: string[]): Promise<{ [conversationId: string]: string[] }> {
    const result: { [conversationId: string]: string[] } = {};

    try {
      for (const conversationId of conversationIds) {
        result[conversationId] = await this.getTypingUsers(conversationId);
      }
    } catch (error) {
      this.logger.error(`Failed to get bulk typing users: ${error.message}`, error.stack);
    }

    return result;
  }

  /**
   * Extend typing indicator timeout (when user continues typing)
   */
  async extendTyping(userId: string, conversationId: string): Promise<void> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      const exists = await this.redis.exists(key);
      
      if (exists) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.typingTimeout * 1000);
        
        await this.redis.hset(key, {
          expiresAt: expiresAt.toISOString(),
        });
        
        // Update expiration
        await this.redis.expire(key, this.typingTimeout);
        
        this.logger.debug(`Extended typing indicator for user ${userId} in conversation ${conversationId}`);
      } else {
        // Start typing if not already typing
        await this.startTyping(userId, conversationId);
      }
    } catch (error) {
      this.logger.error(`Failed to extend typing indicator: ${error.message}`, error.stack);
    }
  }

  /**
   * Stop all typing indicators for a user (when they disconnect)
   */
  async stopAllTypingForUser(userId: string): Promise<void> {
    try {
      const pattern = `typing:*:${userId}`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Stopped all typing indicators for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to stop all typing for user: ${error.message}`, error.stack);
    }
  }

  /**
   * Get typing statistics for monitoring
   */
  async getTypingStats(): Promise<{
    activeIndicators: number;
    conversationsWithTyping: number;
  }> {
    try {
      const pattern = 'typing:*';
      const keys = await this.redis.keys(pattern);
      
      const conversationIds = new Set<string>();
      let activeIndicators = 0;
      const now = Date.now();

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        
        if (data && data.conversationId && data.expiresAt) {
          const expiresAt = new Date(data.expiresAt).getTime();
          
          if (now < expiresAt) {
            activeIndicators++;
            conversationIds.add(data.conversationId);
          } else {
            // Clean up expired indicator
            await this.redis.del(key);
          }
        }
      }

      return {
        activeIndicators,
        conversationsWithTyping: conversationIds.size,
      };
    } catch (error) {
      this.logger.error(`Failed to get typing stats: ${error.message}`, error.stack);
      return { activeIndicators: 0, conversationsWithTyping: 0 };
    }
  }

  /**
   * Background job to clean up expired typing indicators
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async cleanupExpiredTypingIndicators(): Promise<void> {
    try {
      const pattern = 'typing:*';
      const keys = await this.redis.keys(pattern);
      
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        
        if (data && data.expiresAt) {
          const expiresAt = new Date(data.expiresAt).getTime();
          
          if (now >= expiresAt) {
            await this.redis.del(key);
            cleanedCount++;
          }
        } else if (!data || Object.keys(data).length === 0) {
          // Clean up empty keys
          await this.redis.del(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} expired typing indicators`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup expired typing indicators: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all typing indicators for a conversation with details
   */
  async getTypingIndicators(conversationId: string): Promise<TypingIndicator[]> {
    try {
      const pattern = `typing:${conversationId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const indicators: TypingIndicator[] = [];
      const now = Date.now();

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        
        if (data && data.userId && data.startedAt && data.expiresAt) {
          const expiresAt = new Date(data.expiresAt).getTime();
          
          if (now < expiresAt) {
            indicators.push({
              userId: data.userId,
              conversationId: data.conversationId,
              startedAt: new Date(data.startedAt),
              expiresAt: new Date(data.expiresAt),
            });
          } else {
            // Clean up expired indicator
            await this.redis.del(key);
          }
        }
      }

      return indicators;
    } catch (error) {
      this.logger.error(`Failed to get typing indicators: ${error.message}`, error.stack);
      return [];
    }
  }
}