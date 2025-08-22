import { Injectable, Logger, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Message } from '../database/entities/message.entity';
import { Conversation } from '../database/entities/conversation.entity';
import { MessageType } from '../database/entities/message.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { SanitizationService } from '../common/services/sanitization.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
    private readonly sanitizationService: SanitizationService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
  ) { }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
  ): Promise<Message> {
    // Verify user is a participant in the conversation
    const conversation = await this.conversationsService.getConversation(conversationId, senderId);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Sanitize message content
    const sanitizedContent = this.sanitizationService.sanitizeMessageContent(content);

    if (!sanitizedContent) {
      throw new ForbiddenException('Message content is invalid or empty after sanitization');
    }

    // Create and save the message
    const message = this.messageRepository.create({
      conversationId,
      senderId,
      content: sanitizedContent,
      type,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's last activity and last message
    await this.conversationRepository.update(conversationId, {
      lastActivity: new Date(),
      lastMessageId: savedMessage.id,
    });

    this.logger.log(`Message ${savedMessage.id} sent in conversation ${conversationId}`);
    return savedMessage;
  }

  /**
   * Broadcast message with profile enrichment
   */
  async broadcastEnrichedMessage(conversationId: string, enrichedMessage: any): Promise<void> {
    try {
      await this.realtimeGateway.broadcastMessage(conversationId, {
        id: enrichedMessage.id,
        content: enrichedMessage.content,
        type: enrichedMessage.type,
        senderId: enrichedMessage.senderId,
        conversationId: enrichedMessage.conversationId,
        createdAt: enrichedMessage.createdAt,
        sender: enrichedMessage.sender // This now includes enriched profile data
      });
      this.logger.log(`Enriched message ${enrichedMessage.id} broadcasted to conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast enriched message ${enrichedMessage.id}: ${error.message}`);
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    // Verify user is a participant in the conversation
    await this.conversationsService.getConversation(conversationId, userId);

    const offset = (page - 1) * limit;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: {
        conversationId,
        deletedAt: null, // Only non-deleted messages
      },
      order: {
        sentAt: 'DESC', // Most recent first
      },
      skip: offset,
      take: limit,
      relations: ['sender'],
    });

    return {
      messages: messages.reverse(), // Reverse to show oldest first in the page
      total,
      hasMore: offset + messages.length < total,
    };
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, deletedAt: null },
      relations: ['sender', 'conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify user is a participant in the conversation
    await this.conversationsService.getConversation(message.conversationId, userId);

    return message;
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.getMessage(messageId, userId);

    // Only the sender can delete their own messages
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Soft delete the message
    await this.messageRepository.update(messageId, {
      deletedAt: new Date(),
    });

    this.logger.log(`Message ${messageId} soft deleted by user ${userId}`);
  }

  /**
   * Get message history for a conversation (for real-time sync)
   */
  async getMessagesSince(
    conversationId: string,
    userId: string,
    since: Date,
  ): Promise<Message[]> {
    // Verify user is a participant in the conversation
    await this.conversationsService.getConversation(conversationId, userId);

    return this.messageRepository.find({
      where: {
        conversationId,
        sentAt: MoreThan(since),
        deletedAt: null,
      },
      order: {
        sentAt: 'ASC',
      },
      relations: ['sender'],
    });
  }

  /**
   * Background job to clean up old messages (90-day retention)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async archiveOldMessages(): Promise<void> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
      // Soft delete messages older than 90 days
      const result = await this.messageRepository.update(
        {
          sentAt: LessThan(ninetyDaysAgo),
          deletedAt: null,
        },
        {
          deletedAt: new Date(),
        },
      );

      this.logger.log(`Archived ${result.affected} messages older than 90 days`);
    } catch (error) {
      this.logger.error(`Failed to archive old messages: ${error.message}`, error.stack);
    }
  }

  /**
   * Background job to hard delete messages after 7-day audit period
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async hardDeleteOldMessages(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      // Hard delete messages that were soft deleted more than 7 days ago
      const result = await this.messageRepository.delete({
        deletedAt: LessThan(sevenDaysAgo),
      });

      this.logger.log(`Hard deleted ${result.affected} messages after 7-day audit period`);
    } catch (error) {
      this.logger.error(`Failed to hard delete old messages: ${error.message}`, error.stack);
    }
  }

  /**
   * Get message count for a conversation
   */
  async getMessageCount(conversationId: string, userId: string): Promise<number> {
    // Verify user is a participant in the conversation
    await this.conversationsService.getConversation(conversationId, userId);

    return this.messageRepository.count({
      where: {
        conversationId,
        deletedAt: null,
      },
    });
  }

  /**
   * Search messages in a conversation
   */
  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    // Verify user is a participant in the conversation
    await this.conversationsService.getConversation(conversationId, userId);

    const offset = (page - 1) * limit;

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.deletedAt IS NULL')
      .andWhere('LOWER(message.content) LIKE LOWER(:query)', { query: `%${query}%` })
      .orderBy('message.sentAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [messages, total] = await queryBuilder.getManyAndCount();

    return {
      messages,
      total,
      hasMore: offset + messages.length < total,
    };
  }
}