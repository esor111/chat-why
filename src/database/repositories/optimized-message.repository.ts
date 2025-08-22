import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Message } from '../entities/message.entity';

@Injectable()
export class OptimizedMessageRepository {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Get messages with optimized pagination and caching
   */
  async getConversationMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
    includeDeleted: boolean = false,
  ): Promise<{ messages: Message[]; total: number }> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.sentAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (!includeDeleted) {
      queryBuilder.andWhere('message.deletedAt IS NULL');
    }

    // Use index hint for better performance
    queryBuilder.setParameters({
      conversationId,
    });

    const [messages, total] = await queryBuilder.getManyAndCount();

    return { messages, total };
  }

  /**
   * Get recent messages across multiple conversations (optimized for conversation list)
   */
  async getRecentMessagesForConversations(
    conversationIds: string[],
    limit: number = 1,
  ): Promise<Message[]> {
    if (conversationIds.length === 0) return [];

    // Use window function for efficient "latest message per conversation" query
    const query = `
      SELECT DISTINCT ON (m."conversationId") 
        m.id, m.content, m.type, m."sentAt", m."senderId", m."conversationId",
        u."kahaId" as "senderKahaId"
      FROM messages m
      LEFT JOIN users u ON m."senderId" = u.id
      WHERE m."conversationId" = ANY($1)
        AND m."deletedAt" IS NULL
      ORDER BY m."conversationId", m."sentAt" DESC
      LIMIT $2
    `;

    return this.messageRepository.query(query, [conversationIds, limit * conversationIds.length]);
  }

  /**
   * Get unread message count for a user across all conversations
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM messages m
      INNER JOIN participants p ON m."conversationId" = p."conversationId"
      LEFT JOIN messages last_read ON p."lastReadMessageId" = last_read.id
      WHERE p."userId" = $1
        AND m."deletedAt" IS NULL
        AND m."senderId" != $1
        AND (
          p."lastReadMessageId" IS NULL 
          OR m."sentAt" > last_read."sentAt"
        )
    `;

    const result = await this.messageRepository.query(query, [userId]);
    return parseInt(result[0]?.count || '0');
  }

  /**
   * Get message statistics for analytics
   */
  async getMessageStatistics(
    conversationId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesByHour: Record<string, number>;
    averageMessageLength: number;
  }> {
    let queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.deletedAt IS NULL');

    if (conversationId) {
      queryBuilder.andWhere('message.conversationId = :conversationId', { conversationId });
    }

    if (startDate) {
      queryBuilder.andWhere('message.sentAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('message.sentAt <= :endDate', { endDate });
    }

    // Get total count
    const totalMessages = await queryBuilder.getCount();

    // Get messages by type
    const messagesByTypeQuery = queryBuilder
      .clone()
      .select('message.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('message.type');

    const messagesByTypeResult = await messagesByTypeQuery.getRawMany();
    const messagesByType = messagesByTypeResult.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    // Get messages by hour
    const messagesByHourQuery = queryBuilder
      .clone()
      .select('EXTRACT(HOUR FROM message.sentAt)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .groupBy('EXTRACT(HOUR FROM message.sentAt)')
      .orderBy('hour');

    const messagesByHourResult = await messagesByHourQuery.getRawMany();
    const messagesByHour = messagesByHourResult.reduce((acc, row) => {
      acc[row.hour] = parseInt(row.count);
      return acc;
    }, {});

    // Get average message length
    const avgLengthResult = await queryBuilder
      .clone()
      .select('AVG(LENGTH(message.content))', 'avgLength')
      .getRawOne();

    const averageMessageLength = parseFloat(avgLengthResult?.avgLength || '0');

    return {
      totalMessages,
      messagesByType,
      messagesByHour,
      averageMessageLength,
    };
  }

  /**
   * Bulk insert messages for better performance
   */
  async bulkInsertMessages(messages: Partial<Message>[]): Promise<Message[]> {
    if (messages.length === 0) return [];

    // Use batch insert for better performance
    const batchSize = 100;
    const results: Message[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const insertResult = await this.messageRepository
        .createQueryBuilder()
        .insert()
        .into(Message)
        .values(batch)
        .returning('*')
        .execute();

      results.push(...insertResult.generatedMaps as Message[]);
    }

    return results;
  }

  /**
   * Optimized search for messages with full-text search
   */
  async searchMessages(
    query: string,
    conversationIds?: string[],
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ messages: Message[]; total: number }> {
    let queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.conversation', 'conversation')
      .where('message.deletedAt IS NULL')
      .andWhere('to_tsvector(\'english\', message.content) @@ plainto_tsquery(\'english\', :query)', { query })
      .orderBy('ts_rank(to_tsvector(\'english\', message.content), plainto_tsquery(\'english\', :query))', 'DESC')
      .addOrderBy('message.sentAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (conversationIds && conversationIds.length > 0) {
      queryBuilder.andWhere('message.conversationId IN (:...conversationIds)', { conversationIds });
    }

    const [messages, total] = await queryBuilder.getManyAndCount();

    return { messages, total };
  }

  /**
   * Clean up old deleted messages (for maintenance)
   */
  async cleanupOldDeletedMessages(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.messageRepository
      .createQueryBuilder()
      .delete()
      .from(Message)
      .where('deletedAt IS NOT NULL')
      .andWhere('deletedAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}