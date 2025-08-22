import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagesService } from './messages.service';
import { Message } from '../database/entities/message.entity';
import { Conversation } from '../database/entities/conversation.entity';
import { Participant } from '../database/entities/participant.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageType } from '../database/entities/message.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SanitizationService } from '../common/services/sanitization.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let conversationRepository: jest.Mocked<Repository<Conversation>>;
  let conversationsService: jest.Mocked<ConversationsService>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockConversationsService = {
    getConversation: jest.fn(),
  };

  const mockSanitizationService = {
    sanitizeMessageContent: jest.fn().mockImplementation((content: string) => content.trim()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Participant),
          useValue: mockRepository,
        },
        {
          provide: ConversationsService,
          useValue: mockConversationsService,
        },
        {
          provide: SanitizationService,
          useValue: mockSanitizationService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    messageRepository = module.get(getRepositoryToken(Message));
    conversationRepository = module.get(getRepositoryToken(Conversation));
    conversationsService = module.get(ConversationsService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const conversationId = 'conv-123';
      const senderId = 'user-123';
      const content = 'Hello world';
      const mockConversation = { id: conversationId };
      const mockMessage = {
        id: 'msg-123',
        conversationId,
        senderId,
        content,
        type: MessageType.TEXT,
      };

      conversationsService.getConversation.mockResolvedValue(mockConversation as any);
      messageRepository.create.mockReturnValue(mockMessage as any);
      messageRepository.save.mockResolvedValue(mockMessage as any);
      conversationRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.sendMessage(conversationId, senderId, content);

      expect(result).toEqual(mockMessage);
      expect(conversationsService.getConversation).toHaveBeenCalledWith(conversationId, senderId);
      expect(messageRepository.create).toHaveBeenCalledWith({
        conversationId,
        senderId,
        content,
        type: MessageType.TEXT,
      });
      expect(messageRepository.save).toHaveBeenCalledWith(mockMessage);
      expect(conversationRepository.update).toHaveBeenCalledWith(conversationId, {
        lastActivity: expect.any(Date),
        lastMessageId: mockMessage.id,
      });
    });

    it('should throw NotFoundException when conversation not found', async () => {
      const conversationId = 'conv-123';
      const senderId = 'user-123';
      const content = 'Hello world';

      conversationsService.getConversation.mockResolvedValue(null);

      await expect(
        service.sendMessage(conversationId, senderId, content)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessages', () => {
    it('should get messages with pagination', async () => {
      const conversationId = 'conv-123';
      const userId = 'user-123';
      const mockConversation = { id: conversationId };
      const mockMessages = [
        { id: 'msg-1', content: 'Message 1' },
        { id: 'msg-2', content: 'Message 2' },
      ];

      conversationsService.getConversation.mockResolvedValue(mockConversation as any);
      messageRepository.findAndCount.mockResolvedValue([mockMessages, 2] as any);

      const result = await service.getMessages(conversationId, userId, 1, 50);

      expect(result).toEqual({
        messages: mockMessages.reverse(),
        total: 2,
        hasMore: false,
      });
      expect(conversationsService.getConversation).toHaveBeenCalledWith(conversationId, userId);
    });
  });

  describe('getMessage', () => {
    it('should get a specific message', async () => {
      const messageId = 'msg-123';
      const userId = 'user-123';
      const mockMessage = {
        id: messageId,
        conversationId: 'conv-123',
        content: 'Test message',
      };

      messageRepository.findOne.mockResolvedValue(mockMessage as any);
      conversationsService.getConversation.mockResolvedValue({ id: 'conv-123' } as any);

      const result = await service.getMessage(messageId, userId);

      expect(result).toEqual(mockMessage);
      expect(messageRepository.findOne).toHaveBeenCalledWith({
        where: { id: messageId, deletedAt: null },
        relations: ['sender', 'conversation'],
      });
    });

    it('should throw NotFoundException when message not found', async () => {
      const messageId = 'msg-123';
      const userId = 'user-123';

      messageRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getMessage(messageId, userId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMessage', () => {
    it('should delete own message', async () => {
      const messageId = 'msg-123';
      const userId = 'user-123';
      const mockMessage = {
        id: messageId,
        senderId: userId,
        conversationId: 'conv-123',
      };

      messageRepository.findOne.mockResolvedValue(mockMessage as any);
      conversationsService.getConversation.mockResolvedValue({ id: 'conv-123' } as any);
      messageRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.deleteMessage(messageId, userId);

      expect(messageRepository.update).toHaveBeenCalledWith(messageId, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw ForbiddenException when trying to delete others message', async () => {
      const messageId = 'msg-123';
      const userId = 'user-123';
      const mockMessage = {
        id: messageId,
        senderId: 'other-user',
        conversationId: 'conv-123',
      };

      messageRepository.findOne.mockResolvedValue(mockMessage as any);
      conversationsService.getConversation.mockResolvedValue({ id: 'conv-123' } as any);

      await expect(
        service.deleteMessage(messageId, userId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchMessages', () => {
    it('should search messages in conversation', async () => {
      const conversationId = 'conv-123';
      const userId = 'user-123';
      const query = 'test';
      const mockMessages = [{ id: 'msg-1', content: 'test message' }];

      conversationsService.getConversation.mockResolvedValue({ id: conversationId } as any);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockMessages, 1]),
      };

      messageRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.searchMessages(conversationId, userId, query, 1, 20);

      expect(result).toEqual({
        messages: mockMessages,
        total: 1,
        hasMore: false,
      });
    });
  });

  describe('getMessageCount', () => {
    it('should get message count for conversation', async () => {
      const conversationId = 'conv-123';
      const userId = 'user-123';

      conversationsService.getConversation.mockResolvedValue({ id: conversationId } as any);
      messageRepository.count.mockResolvedValue(5);

      const result = await service.getMessageCount(conversationId, userId);

      expect(result).toBe(5);
      expect(messageRepository.count).toHaveBeenCalledWith({
        where: {
          conversationId,
          deletedAt: null,
        },
      });
    });
  });
});