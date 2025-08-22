import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource, QueryRunner } from "typeorm";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { Conversation } from "../database/entities/conversation.entity";
import { Participant } from "../database/entities/participant.entity";
import { Message } from "../database/entities/message.entity";
import { User } from "../database/entities/user.entity";
import { ConversationType } from "../database/entities/conversation.entity";
import { ParticipantRole } from "../database/entities/participant.entity";
import { AuditService } from "../common/services/audit.service";

describe("ConversationsService", () => {
  let service: ConversationsService;
  let conversationRepository: jest.Mocked<Repository<Conversation>>;
  let participantRepository: jest.Mocked<Repository<Participant>>;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockConversation = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    type: ConversationType.DIRECT,
    participants: [
      {
        userId: "550e8400-e29b-41d4-a716-446655440001",
        role: ParticipantRole.MEMBER,
      },
      {
        userId: "550e8400-e29b-41d4-a716-446655440002",
        role: ParticipantRole.MEMBER,
      },
    ],
  } as Conversation;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
      },
    } as any;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Participant),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AuditService,
          useValue: {
            logConversationAccess: jest.fn(),
            logParticipantOperation: jest.fn(),
            logBusinessOperation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    conversationRepository = module.get(getRepositoryToken(Conversation));
    participantRepository = module.get(getRepositoryToken(Participant));
    messageRepository = module.get(getRepositoryToken(Message));
    userRepository = module.get(getRepositoryToken(User));
  });

  describe("createDirectConversation", () => {
    it("should create a direct conversation between two users", async () => {
      const initiatorId = "user-1";
      const targetUserId = "user-2";
      const savedConversation = {
        id: "conv-123",
        type: ConversationType.DIRECT,
      };

      // Mock no existing conversation
      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      queryRunner.manager.create = jest
        .fn()
        .mockReturnValueOnce(savedConversation)
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: initiatorId,
          role: ParticipantRole.MEMBER,
        })
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: targetUserId,
          role: ParticipantRole.MEMBER,
        });

      queryRunner.manager.save = jest
        .fn()
        .mockResolvedValueOnce(savedConversation)
        .mockResolvedValueOnce([]);

      const result = await service.createDirectConversation(
        initiatorId,
        targetUserId
      );

      expect(result).toEqual(savedConversation);
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should return existing direct conversation if it exists", async () => {
      const initiatorId = "user-1";
      const targetUserId = "user-2";

      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockConversation),
      });

      const result = await service.createDirectConversation(
        initiatorId,
        targetUserId
      );

      expect(result).toEqual(mockConversation);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it("should throw error when trying to create conversation with self", async () => {
      const userId = "user-1";

      await expect(
        service.createDirectConversation(userId, userId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("createGroupConversation", () => {
    it("should create a group conversation with valid participants", async () => {
      const creatorId = "user-1";
      const participantIds = ["user-2", "user-3"];
      const name = "Test Group";
      const savedConversation = {
        id: "conv-123",
        type: ConversationType.GROUP,
        name,
      };

      queryRunner.manager.create = jest
        .fn()
        .mockReturnValueOnce(savedConversation)
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: creatorId,
          role: ParticipantRole.ADMIN,
        })
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: "user-2",
          role: ParticipantRole.MEMBER,
        })
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: "user-3",
          role: ParticipantRole.MEMBER,
        });

      queryRunner.manager.save = jest
        .fn()
        .mockResolvedValueOnce(savedConversation)
        .mockResolvedValueOnce([]);

      const result = await service.createGroupConversation(
        creatorId,
        participantIds,
        name
      );

      expect(result).toEqual(savedConversation);
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("should throw error when group has too many participants", async () => {
      const creatorId = "user-1";
      const participantIds = [
        "user-2",
        "user-3",
        "user-4",
        "user-5",
        "user-6",
        "user-7",
        "user-8",
        "user-9",
      ];

      await expect(
        service.createGroupConversation(creatorId, participantIds)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when group has too few participants", async () => {
      const creatorId = "user-1";
      const participantIds = ["user-2"];

      await expect(
        service.createGroupConversation(creatorId, participantIds)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("createBusinessConversation", () => {
    it("should create a business conversation with customer and agent", async () => {
      const customerId = "user-1";
      const businessId = "business-1";
      const agentId = "agent-1";
      const savedConversation = {
        id: "conv-123",
        type: ConversationType.BUSINESS,
        businessId,
      };

      queryRunner.manager.create = jest
        .fn()
        .mockReturnValueOnce(savedConversation)
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: customerId,
          role: ParticipantRole.CUSTOMER,
        })
        .mockReturnValueOnce({
          conversationId: "conv-123",
          userId: agentId,
          role: ParticipantRole.AGENT,
        });

      queryRunner.manager.save = jest
        .fn()
        .mockResolvedValueOnce(savedConversation)
        .mockResolvedValueOnce([]);

      const result = await service.createBusinessConversation(
        customerId,
        businessId,
        agentId
      );

      expect(result).toEqual(savedConversation);
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("getConversation", () => {
    it("should return conversation when user is participant", async () => {
      const conversationId = "conv-123";
      const userId = "550e8400-e29b-41d4-a716-446655440001"; // Use a participant ID

      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockConversation),
      });

      const result = await service.getConversation(conversationId, userId);

      expect(result).toEqual(mockConversation);
    });

    it("should throw NotFoundException when conversation does not exist", async () => {
      const conversationId = "conv-123";
      const userId = "user-1";

      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getConversation(conversationId, userId)
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user is not participant", async () => {
      const conversationId = "conv-123";
      const userId = "user-3";

      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockConversation),
      });

      await expect(
        service.getConversation(conversationId, userId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("addParticipant", () => {
    it("should add participant to group conversation when user is admin", async () => {
      const conversationId = "conv-123";
      const userId = "user-1";
      const newParticipantId = "user-3";
      const groupConversation = {
        ...mockConversation,
        type: ConversationType.GROUP,
        participants: [
          { userId: "user-1", role: ParticipantRole.ADMIN },
          { userId: "user-2", role: ParticipantRole.MEMBER },
        ],
      };

      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(groupConversation),
      });

      participantRepository.findOne.mockResolvedValue(null);
      const mockParticipant = {
        conversationId,
        userId: newParticipantId,
        role: ParticipantRole.MEMBER,
        lastReadMessageId: null,
        isMuted: false,
        lastReadAt: null,
        joinedAt: new Date(),
        user: null,
        conversation: null,
        lastReadMessage: null,
      } as Participant;
      participantRepository.create.mockReturnValue(mockParticipant);
      participantRepository.save.mockResolvedValue(mockParticipant);

      const result = await service.addParticipant(
        conversationId,
        userId,
        newParticipantId
      );

      expect(result).toBeDefined();
      expect(participantRepository.save).toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user is not admin in group conversation", async () => {
      const conversationId = "conv-123";
      const userId = "user-2";
      const newParticipantId = "user-3";
      const groupConversation = {
        ...mockConversation,
        type: ConversationType.GROUP,
        participants: [
          { userId: "user-1", role: ParticipantRole.ADMIN },
          { userId: "user-2", role: ParticipantRole.MEMBER },
        ],
      };

      conversationRepository.createQueryBuilder = jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(groupConversation),
      });

      await expect(
        service.addParticipant(conversationId, userId, newParticipantId)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
