import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from '../database/entities/participant.entity';
import { Message } from '../database/entities/message.entity';

export interface ReadReceipt {
  userId: string;
  messageId: string;
  conversationId: string;
  readAt: Date;
}

export interface MessageReadStatus {
  messageId: string;
  readBy: ReadReceipt[];
  unreadBy: string[];
  readCount: number;
  totalParticipants: number;
}

@Injectable()
export class ReadReceiptService {
  private readonly logger = new Logger(ReadReceiptService.name);

  constructor(
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Mark a message as read by a user
   */
  async markAsRead(userId: string, conversationId: string, messageId: string): Promise<void> {
    try {
      // Verify the message exists and belongs to the conversation
      const message = await this.messageRepository.findOne({
        where: { id: messageId, conversationId },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user is a participant
      const participant = await this.participantRepository.findOne({
        where: { userId, conversationId },
      });

      if (!participant) {
        throw new Error('User is not a participant in this conversation');
      }

      // Update participant's last read message and timestamp
      participant.lastReadMessageId = messageId;
      participant.lastReadAt = new Date();

      await this.participantRepository.save(participant);

      this.logger.debug(`User ${userId} marked message ${messageId} as read`);
    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get read receipts for a specific message
   */
  async getMessageReadReceipts(messageId: string): Promise<ReadReceipt[]> {
    try {
      const message = await this.messageRepository.findOne({
        where: { id: messageId },
        select: ['conversationId', 'createdAt'],
      });

      if (!message) {
        return [];
      }

      // Get all participants who have read this message or later
      const participants = await this.participantRepository
        .createQueryBuilder('participant')
        .leftJoinAndSelect('participant.lastReadMessage', 'lastReadMessage')
        .where('participant.conversationId = :conversationId', { 
          conversationId: message.conversationId 
        })
        .andWhere('participant.lastReadAt IS NOT NULL')
        .andWhere(
          '(lastReadMessage.createdAt >= :messageCreatedAt OR participant.lastReadAt >= :messageCreatedAt)',
          { messageCreatedAt: message.createdAt }
        )
        .getMany();

      const readReceipts: ReadReceipt[] = participants.map(participant => ({
        userId: participant.userId,
        messageId,
        conversationId: message.conversationId,
        readAt: participant.lastReadAt!,
      }));

      return readReceipts;
    } catch (error) {
      this.logger.error(`Failed to get message read receipts: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get read status for multiple messages
   */
  async getBulkMessageReadStatus(messageIds: string[]): Promise<{ [messageId: string]: MessageReadStatus }> {
    const result: { [messageId: string]: MessageReadStatus } = {};

    try {
      for (const messageId of messageIds) {
        const readReceipts = await this.getMessageReadReceipts(messageId);
        const message = await this.messageRepository.findOne({
          where: { id: messageId },
          select: ['conversationId'],
        });

        if (message) {
          // Get all participants in the conversation
          const allParticipants = await this.participantRepository.find({
            where: { conversationId: message.conversationId },
            select: ['userId'],
          });

          const readByUserIds = new Set(readReceipts.map(r => r.userId));
          const unreadBy = allParticipants
            .map(p => p.userId)
            .filter(userId => !readByUserIds.has(userId));

          result[messageId] = {
            messageId,
            readBy: readReceipts,
            unreadBy,
            readCount: readReceipts.length,
            totalParticipants: allParticipants.length,
          };
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get bulk message read status: ${error.message}`, error.stack);
    }

    return result;
  }

  /**
   * Get unread message count for a user in a conversation
   */
  async getUnreadCount(userId: string, conversationId: string): Promise<number> {
    try {
      const participant = await this.participantRepository.findOne({
        where: { userId, conversationId },
        relations: ['lastReadMessage'],
      });

      if (!participant) {
        return 0;
      }

      const query = this.messageRepository
        .createQueryBuilder('message')
        .where('message.conversationId = :conversationId', { conversationId })
        .andWhere('message.senderId != :userId', { userId })
        .andWhere('message.deletedAt IS NULL');

      if (participant.lastReadAt) {
        query.andWhere('message.createdAt > :lastReadAt', {
          lastReadAt: participant.lastReadAt,
        });
      } else if (participant.joinedAt) {
        query.andWhere('message.createdAt > :joinedAt', {
          joinedAt: participant.joinedAt,
        });
      }

      return await query.getCount();
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Get unread counts for all user's conversations
   */
  async getAllUnreadCounts(userId: string): Promise<{ [conversationId: string]: number }> {
    try {
      const participants = await this.participantRepository.find({
        where: { userId },
        select: ['conversationId'],
      });

      const unreadCounts: { [conversationId: string]: number } = {};

      for (const participant of participants) {
        unreadCounts[participant.conversationId] = await this.getUnreadCount(
          userId,
          participant.conversationId
        );
      }

      return unreadCounts;
    } catch (error) {
      this.logger.error(`Failed to get all unread counts: ${error.message}`, error.stack);
      return {};
    }
  }

  /**
   * Mark all messages in a conversation as read by a user
   */
  async markAllAsRead(userId: string, conversationId: string): Promise<void> {
    try {
      // Get the latest message in the conversation
      const latestMessage = await this.messageRepository.findOne({
        where: { conversationId, deletedAt: null },
        order: { createdAt: 'DESC' },
      });

      if (!latestMessage) {
        return; // No messages to mark as read
      }

      await this.markAsRead(userId, conversationId, latestMessage.id);
    } catch (error) {
      this.logger.error(`Failed to mark all messages as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get the last read message for a user in a conversation
   */
  async getLastReadMessage(userId: string, conversationId: string): Promise<Message | null> {
    try {
      const participant = await this.participantRepository.findOne({
        where: { userId, conversationId },
        relations: ['lastReadMessage'],
      });

      return participant?.lastReadMessage || null;
    } catch (error) {
      this.logger.error(`Failed to get last read message: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Check if a message has been read by a specific user
   */
  async hasUserReadMessage(userId: string, messageId: string): Promise<boolean> {
    try {
      const message = await this.messageRepository.findOne({
        where: { id: messageId },
        select: ['conversationId', 'createdAt'],
      });

      if (!message) {
        return false;
      }

      const participant = await this.participantRepository.findOne({
        where: { userId, conversationId: message.conversationId },
        relations: ['lastReadMessage'],
      });

      if (!participant || !participant.lastReadAt) {
        return false;
      }

      // Check if the user's last read time is after this message's creation time
      return participant.lastReadAt >= message.createdAt;
    } catch (error) {
      this.logger.error(`Failed to check if user read message: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get read receipt statistics for a conversation
   */
  async getConversationReadStats(conversationId: string): Promise<{
    totalMessages: number;
    fullyReadMessages: number;
    partiallyReadMessages: number;
    unreadMessages: number;
  }> {
    try {
      // Get total participants count
      const participantCount = await this.participantRepository.count({
        where: { conversationId },
      });

      // Get all messages in the conversation
      const messages = await this.messageRepository.find({
        where: { conversationId, deletedAt: null },
        select: ['id'],
      });

      let fullyReadMessages = 0;
      let partiallyReadMessages = 0;
      let unreadMessages = 0;

      for (const message of messages) {
        const readReceipts = await this.getMessageReadReceipts(message.id);
        const readCount = readReceipts.length;

        if (readCount === participantCount) {
          fullyReadMessages++;
        } else if (readCount > 0) {
          partiallyReadMessages++;
        } else {
          unreadMessages++;
        }
      }

      return {
        totalMessages: messages.length,
        fullyReadMessages,
        partiallyReadMessages,
        unreadMessages,
      };
    } catch (error) {
      this.logger.error(`Failed to get conversation read stats: ${error.message}`, error.stack);
      return {
        totalMessages: 0,
        fullyReadMessages: 0,
        partiallyReadMessages: 0,
        unreadMessages: 0,
      };
    }
  }
}