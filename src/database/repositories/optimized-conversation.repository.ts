import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationType } from '../entities/conversation.entity';
import { Participant } from '../entities/participant.entity';

@Injectable()
export class OptimizedConversationRepository {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
  ) {}

  /**
   * Get user conversations with optimized joins and pagination
   */
  async getUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    type?: ConversationType,
  ): Promise<{ conversations: any[]; total: number }> {
    let queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant', 'participant.userId = :userId', { userId })
      .leftJoinAndSelect('conversation.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
      .leftJoinAndSelect('conversation.participants', 'allParticipants')
      .leftJoinAndSelect('allParticipants.user', 'participantUser')
      .orderBy('conversation.lastActivity', 'DESC')
      .limit(limit)
      .offset(offset);

    if (type) {
      queryBuilder.andWhere('conversation.type = :type', { type });
    }

    const [conversations, total] = await queryBuilder.getManyAndCount();

    // Add unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await this.getUnreadMessageCount(conversation.id, userId);
        return {
          ...conversation,
          unreadCount,
        };
      })
    );

    return { conversations: conversationsWithUnread, total };
  }

  /**
   * Get unread message count for a specific conversation and user
   */
  async getUnreadMessageCount(conversationId: string, userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM messages m
      INNER JOIN participants p ON m."conversationId" = p."conversationId"
      LEFT JOIN messages last_read ON p."lastReadMessageId" = last_read.id
      WHERE p."conversationId" = $1
        AND p."userId" = $2
        AND m."deletedAt" IS NULL
        AND m."senderId" != $2
        AND (
          p."lastReadMessageId" IS NULL 
          OR m."sentAt" > last_read."sentAt"
        )
    `;

    const result = await this.conversationRepository.query(query, [conversationId, userId]);
    return parseInt(result[0]?.count || '0');
  }

  /**
   * Get business conversations with agent assignment optimization
   */
  async getBusinessConversations(
    businessId: string,
    agentId?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ conversations: Conversation[]; total: number }> {
    let queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'user')
      .leftJoinAndSelect('conversation.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
      .where('conversation.type = :type', { type: ConversationType.BUSINESS })
      .andWhere('conversation.businessId = :businessId', { businessId })
      .orderBy('conversation.lastActivity', 'DESC')
      .limit(limit)
      .offset(offset);

    if (agentId) {
      queryBuilder.andWhere(
        'EXISTS (SELECT 1 FROM participants p WHERE p."conversationId" = conversation.id AND p."userId" = :agentId AND p.role = :agentRole)',
        { agentId, agentRole: 'agent' }
      );
    }

    return queryBuilder.getManyAndCount().then(([conversations, total]) => ({
      conversations,
      total,
    }));
  }

  /**
   * Get conversation statistics for analytics
   */
  async getConversationStatistics(
    businessId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalConversations: number;
    conversationsByType: Record<string, number>;
    averageParticipants: number;
    activeConversations: number;
  }> {
    let queryBuilder = this.conversationRepository.createQueryBuilder('conversation');

    if (businessId) {
      queryBuilder.where('conversation.businessId = :businessId', { businessId });
    }

    if (startDate) {
      queryBuilder.andWhere('conversation.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('conversation.createdAt <= :endDate', { endDate });
    }

    // Total conversations
    const totalConversations = await queryBuilder.getCount();

    // Conversations by type
    const conversationsByTypeQuery = queryBuilder
      .clone()
      .select('conversation.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('conversation.type');

    const conversationsByTypeResult = await conversationsByTypeQuery.getRawMany();
    const conversationsByType = conversationsByTypeResult.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    // Average participants per conversation
    const avgParticipantsQuery = `
      SELECT AVG(participant_count) as avg_participants
      FROM (
        SELECT COUNT(*) as participant_count
        FROM participants p
        INNER JOIN conversations c ON p."conversationId" = c.id
        ${businessId ? 'WHERE c."businessId" = $1' : ''}
        GROUP BY p."conversationId"
      ) as subquery
    `;

    const avgParticipantsResult = await this.conversationRepository.query(
      avgParticipantsQuery,
      businessId ? [businessId] : []
    );
    const averageParticipants = parseFloat(avgParticipantsResult[0]?.avg_participants || '0');

    // Active conversations (with activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeConversations = await queryBuilder
      .clone()
      .andWhere('conversation.lastActivity >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();

    return {
      totalConversations,
      conversationsByType,
      averageParticipants,
      activeConversations,
    };
  }

  /**
   * Bulk update last activity for multiple conversations
   */
  async bulkUpdateLastActivity(conversationIds: string[], timestamp: Date = new Date()): Promise<void> {
    if (conversationIds.length === 0) return;

    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ lastActivity: timestamp })
      .where('id IN (:...conversationIds)', { conversationIds })
      .execute();
  }

  /**
   * Find conversations that need cleanup (inactive for specified days)
   */
  async findInactiveConversations(inactiveDays: number = 90): Promise<Conversation[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    return this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.lastActivity < :cutoffDate', { cutoffDate })
      .andWhere('conversation.type != :businessType', { businessType: ConversationType.BUSINESS })
      .getMany();
  }

  /**
   * Get conversation participant count efficiently
   */
  async getParticipantCounts(conversationIds: string[]): Promise<Record<string, number>> {
    if (conversationIds.length === 0) return {};

    const query = `
      SELECT "conversationId", COUNT(*) as count
      FROM participants
      WHERE "conversationId" = ANY($1)
      GROUP BY "conversationId"
    `;

    const results = await this.participantRepository.query(query, [conversationIds]);
    
    return results.reduce((acc, row) => {
      acc[row.conversationId] = parseInt(row.count);
      return acc;
    }, {});
  }

  /**
   * Optimized search for conversations
   */
  async searchConversations(
    userId: string,
    searchTerm: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ conversations: Conversation[]; total: number }> {
    // Search in conversation names and recent message content
    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant', 'participant.userId = :userId', { userId })
      .leftJoinAndSelect('conversation.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
      .leftJoinAndSelect('conversation.participants', 'allParticipants')
      .leftJoinAndSelect('allParticipants.user', 'participantUser')
      .where(
        '(conversation.name ILIKE :searchTerm OR EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = conversation.id AND m.content ILIKE :searchTerm AND m."deletedAt" IS NULL))',
        { searchTerm: `%${searchTerm}%` }
      )
      .orderBy('conversation.lastActivity', 'DESC')
      .limit(limit)
      .offset(offset);

    return queryBuilder.getManyAndCount().then(([conversations, total]) => ({
      conversations,
      total,
    }));
  }
}