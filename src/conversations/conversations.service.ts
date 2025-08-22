import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Conversation } from '../database/entities/conversation.entity';
import { Participant } from '../database/entities/participant.entity';
import { ConversationType } from '../database/entities/conversation.entity';
import { ParticipantRole } from '../database/entities/participant.entity';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a direct conversation between two users
   */
  async createDirectConversation(
    initiatorId: string,
    targetUserId: string,
  ): Promise<Conversation> {
    if (initiatorId === targetUserId) {
      throw new BadRequestException('Cannot create direct conversation with yourself');
    }

    // Check if direct conversation already exists
    const existingConversation = await this.findDirectConversation(initiatorId, targetUserId);
    if (existingConversation) {
      this.logger.debug(`Direct conversation already exists: ${existingConversation.id}`);
      return existingConversation;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create conversation
      const conversation = queryRunner.manager.create(Conversation, {
        type: ConversationType.DIRECT,
      });
      const savedConversation = await queryRunner.manager.save(conversation);

      // Add both participants
      const participants = [
        queryRunner.manager.create(Participant, {
          conversationId: savedConversation.id,
          userId: initiatorId,
          role: ParticipantRole.MEMBER,
        }),
        queryRunner.manager.create(Participant, {
          conversationId: savedConversation.id,
          userId: targetUserId,
          role: ParticipantRole.MEMBER,
        }),
      ];

      await queryRunner.manager.save(participants);
      await queryRunner.commitTransaction();

      this.logger.log(`Created direct conversation ${savedConversation.id} between ${initiatorId} and ${targetUserId}`);
      return savedConversation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create direct conversation: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a group conversation with multiple participants
   */
  async createGroupConversation(
    creatorId: string,
    participantIds: string[],
    name?: string,
  ): Promise<Conversation> {
    // Validate group size (max 8 participants including creator)
    const allParticipants = [creatorId, ...participantIds.filter(id => id !== creatorId)];
    if (allParticipants.length > 8) {
      throw new BadRequestException('Group conversations cannot have more than 8 participants');
    }

    if (allParticipants.length < 3) {
      throw new BadRequestException('Group conversations must have at least 3 participants');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create conversation
      const conversation = queryRunner.manager.create(Conversation, {
        type: ConversationType.GROUP,
        name,
      });
      const savedConversation = await queryRunner.manager.save(conversation);

      // Add creator as admin
      const creatorParticipant = queryRunner.manager.create(Participant, {
        conversationId: savedConversation.id,
        userId: creatorId,
        role: ParticipantRole.ADMIN,
      });

      // Add other participants as members
      const otherParticipants = participantIds
        .filter(id => id !== creatorId)
        .map(userId => 
          queryRunner.manager.create(Participant, {
            conversationId: savedConversation.id,
            userId,
            role: ParticipantRole.MEMBER,
          })
        );

      await queryRunner.manager.save([creatorParticipant, ...otherParticipants]);
      await queryRunner.commitTransaction();

      this.logger.log(`Created group conversation ${savedConversation.id} with ${allParticipants.length} participants`);
      return savedConversation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create group conversation: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a business conversation with agent assignment
   */
  async createBusinessConversation(
    customerId: string,
    businessId: string,
    agentId?: string,
  ): Promise<Conversation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create conversation
      const conversation = queryRunner.manager.create(Conversation, {
        type: ConversationType.BUSINESS,
        businessId,
      });
      const savedConversation = await queryRunner.manager.save(conversation);

      // Add customer as customer role
      const customerParticipant = queryRunner.manager.create(Participant, {
        conversationId: savedConversation.id,
        userId: customerId,
        role: ParticipantRole.CUSTOMER,
      });

      const participants = [customerParticipant];

      // Add agent if specified
      if (agentId) {
        const agentParticipant = queryRunner.manager.create(Participant, {
          conversationId: savedConversation.id,
          userId: agentId,
          role: ParticipantRole.AGENT,
        });
        participants.push(agentParticipant);
      }

      await queryRunner.manager.save(participants);
      await queryRunner.commitTransaction();

      this.logger.log(`Created business conversation ${savedConversation.id} for business ${businessId}`);
      return savedConversation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create business conversation: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Find existing direct conversation between two users
   */
  private async findDirectConversation(userId1: string, userId2: string): Promise<Conversation | null> {
    return await this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'p1', 'p1.userId = :userId1', { userId1 })
      .innerJoin('conversation.participants', 'p2', 'p2.userId = :userId2', { userId2 })
      .where('conversation.type = :type', { type: ConversationType.DIRECT })
      .getOne();
  }

  /**
   * Get conversation by ID with participant validation
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'user')
      .where('conversation.id = :conversationId', { conversationId })
      .getOne();

    if (!conversation) {
      this.auditService.logConversationAccess(userId, conversationId, false);
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      this.auditService.logConversationAccess(userId, conversationId, false);
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Log successful access
    this.auditService.logConversationAccess(userId, conversationId, true);
    return conversation;
  }

  /**
   * Get user's conversations with pagination
   */
  async getUserConversations(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ conversations: Conversation[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * limit;

    const [conversations, total] = await this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant', 'participant.userId = :userId', { userId })
      .leftJoinAndSelect('conversation.participants', 'allParticipants')
      .leftJoinAndSelect('allParticipants.user', 'user')
      .leftJoinAndSelect('conversation.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
      .orderBy('conversation.lastActivity', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      conversations,
      total,
      hasMore: offset + conversations.length < total,
    };
  }

  /**
   * Add participant to a conversation
   */
  async addParticipant(
    conversationId: string,
    userId: string,
    newParticipantId: string,
    role: ParticipantRole = ParticipantRole.MEMBER,
  ): Promise<Participant> {
    const conversation = await this.getConversation(conversationId, userId);

    // Check if user has permission to add participants
    const userParticipant = conversation.participants.find(p => p.userId === userId);
    if (!userParticipant || (conversation.type === ConversationType.GROUP && userParticipant.role !== ParticipantRole.ADMIN)) {
      throw new ForbiddenException('You do not have permission to add participants');
    }

    // Check if participant already exists
    const existingParticipant = await this.participantRepository.findOne({
      where: { conversationId, userId: newParticipantId },
    });

    if (existingParticipant) {
      throw new BadRequestException('User is already a participant in this conversation');
    }

    // Validate group size limit
    if (conversation.type === ConversationType.GROUP) {
      const participantCount = conversation.participants.length;
      if (participantCount >= 8) {
        throw new BadRequestException('Group conversations cannot have more than 8 participants');
      }
    }

    // Create new participant
    const participant = this.participantRepository.create({
      conversationId,
      userId: newParticipantId,
      role,
    });

    const savedParticipant = await this.participantRepository.save(participant);
    this.logger.log(`Added participant ${newParticipantId} to conversation ${conversationId}`);
    
    return savedParticipant;
  }

  /**
   * Remove participant from a conversation
   */
  async removeParticipant(
    conversationId: string,
    userId: string,
    participantToRemoveId: string,
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId, userId);

    // Check if user has permission to remove participants
    const userParticipant = conversation.participants.find(p => p.userId === userId);
    const participantToRemove = conversation.participants.find(p => p.userId === participantToRemoveId);

    if (!participantToRemove) {
      throw new NotFoundException('Participant not found in this conversation');
    }

    // Users can always remove themselves
    const isSelfRemoval = userId === participantToRemoveId;
    
    // For group conversations, only admins can remove others
    if (!isSelfRemoval && conversation.type === ConversationType.GROUP && userParticipant?.role !== ParticipantRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to remove participants');
    }

    // Cannot remove participants from direct conversations (except self-removal)
    if (conversation.type === ConversationType.DIRECT && !isSelfRemoval) {
      throw new BadRequestException('Cannot remove participants from direct conversations');
    }

    // Remove participant
    await this.participantRepository.delete({
      conversationId,
      userId: participantToRemoveId,
    });

    this.logger.log(`Removed participant ${participantToRemoveId} from conversation ${conversationId}`);
  }

  /**
   * Update participant role
   */
  async updateParticipantRole(
    conversationId: string,
    userId: string,
    participantId: string,
    newRole: ParticipantRole,
  ): Promise<Participant> {
    const conversation = await this.getConversation(conversationId, userId);

    // Check if user has permission to update roles
    const userParticipant = conversation.participants.find(p => p.userId === userId);
    if (!userParticipant || userParticipant.role !== ParticipantRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to update participant roles');
    }

    // Find participant to update
    const participant = await this.participantRepository.findOne({
      where: { conversationId, userId: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this conversation');
    }

    // Update role
    participant.role = newRole;
    const updatedParticipant = await this.participantRepository.save(participant);

    this.logger.log(`Updated participant ${participantId} role to ${newRole} in conversation ${conversationId}`);
    return updatedParticipant;
  }

  /**
   * Get unread message count for user's conversations
   */
  async getUnreadCounts(userId: string): Promise<{ [conversationId: string]: number }> {
    const result = await this.participantRepository
      .createQueryBuilder('participant')
      .select('participant.conversationId', 'conversationId')
      .addSelect('COUNT(message.id)', 'unreadCount')
      .leftJoin('messages', 'message', 
        'message.conversationId = participant.conversationId AND message.createdAt > COALESCE(participant.lastReadAt, participant.joinedAt) AND message.senderId != :userId AND message.deletedAt IS NULL',
        { userId }
      )
      .where('participant.userId = :userId', { userId })
      .groupBy('participant.conversationId')
      .getRawMany();

    const unreadCounts: { [conversationId: string]: number } = {};
    result.forEach(row => {
      unreadCounts[row.conversationId] = parseInt(row.unreadCount) || 0;
    });

    return unreadCounts;
  }

  /**
   * Update last read message for a participant
   */
  async updateLastRead(
    conversationId: string,
    userId: string,
    messageId?: string,
  ): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this conversation');
    }

    participant.lastReadMessageId = messageId;
    participant.lastReadAt = new Date();

    await this.participantRepository.save(participant);
    this.logger.debug(`Updated last read for user ${userId} in conversation ${conversationId}`);
  }

  /**
   * Toggle mute status for a conversation
   */
  async toggleMute(conversationId: string, userId: string, isMuted: boolean): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this conversation');
    }

    participant.isMuted = isMuted;
    await this.participantRepository.save(participant);

    this.logger.log(`${isMuted ? 'Muted' : 'Unmuted'} conversation ${conversationId} for user ${userId}`);
  }
}