import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';
import { TypingService } from './typing.service';
import { ReadReceiptService } from './read-receipt.service';
import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  kahaId?: string;
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let presenceService: jest.Mocked<PresenceService>;
  let typingService: jest.Mocked<TypingService>;
  let readReceiptService: jest.Mocked<ReadReceiptService>;
  let mockSocket: jest.Mocked<AuthenticatedSocket>;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    const mockJwtService = {
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockPresenceService = {
      setUserOnline: jest.fn(),
      setUserOffline: jest.fn(),
      updateHeartbeat: jest.fn(),
      getBulkPresence: jest.fn(),
    };

    const mockTypingService = {
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      stopAllTypingForUser: jest.fn(),
    };

    const mockReadReceiptService = {
      markAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PresenceService,
          useValue: mockPresenceService,
        },
        {
          provide: TypingService,
          useValue: mockTypingService,
        },
        {
          provide: ReadReceiptService,
          useValue: mockReadReceiptService,
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    presenceService = module.get(PresenceService);
    typingService = module.get(TypingService);
    readReceiptService = module.get(ReadReceiptService);

    // Setup mock socket
    mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'valid-jwt-token' },
        headers: {},
      },
      disconnect: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;

    // Setup mock server
    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
      emit: jest.fn(),
    } as any;

    gateway.server = mockServer;

    // Setup default config
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_SECRET':
          return 'test-secret';
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate and connect user successfully', async () => {
      const mockPayload = {
        sub: 'user-123',
        kahaId: 'kaha-456',
      };

      jwtService.verify.mockReturnValue(mockPayload);
      presenceService.setUserOnline.mockResolvedValue();

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token', {
        secret: 'test-secret',
      });
      expect(mockSocket.userId).toBe('user-123');
      expect(mockSocket.kahaId).toBe('kaha-456');
      expect(presenceService.setUserOnline).toHaveBeenCalledWith('user-123');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        userId: 'user-123',
        timestamp: expect.any(String),
      });
    });

    it('should disconnect client without token', async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers = {};

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('should disconnect client with invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client with invalid payload', async () => {
      jwtService.verify.mockReturnValue({ sub: null, kahaId: null });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should extract token from authorization header', async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers = { authorization: 'Bearer header-token' };

      const mockPayload = {
        sub: 'user-123',
        kahaId: 'kaha-456',
      };

      jwtService.verify.mockReturnValue(mockPayload);
      presenceService.setUserOnline.mockResolvedValue();

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('header-token', {
        secret: 'test-secret',
      });
    });
  });

  describe('handleDisconnect', () => {
    it('should handle user disconnect properly', async () => {
      mockSocket.userId = 'user-123';
      presenceService.setUserOffline.mockResolvedValue();
      typingService.stopAllTypingForUser.mockResolvedValue();

      await gateway.handleDisconnect(mockSocket);

      expect(presenceService.setUserOffline).toHaveBeenCalledWith('user-123');
      expect(typingService.stopAllTypingForUser).toHaveBeenCalledWith('user-123');
    });

    it('should handle disconnect without userId gracefully', async () => {
      await gateway.handleDisconnect(mockSocket);

      expect(presenceService.setUserOffline).not.toHaveBeenCalled();
      expect(typingService.stopAllTypingForUser).not.toHaveBeenCalled();
    });

    it('should handle errors during disconnect gracefully', async () => {
      mockSocket.userId = 'user-123';
      presenceService.setUserOffline.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(gateway.handleDisconnect(mockSocket)).resolves.not.toThrow();
    });
  });

  describe('handleHeartbeat', () => {
    it('should update heartbeat and send acknowledgment', async () => {
      mockSocket.userId = 'user-123';
      presenceService.updateHeartbeat.mockResolvedValue();

      await gateway.handleHeartbeat(mockSocket);

      expect(presenceService.updateHeartbeat).toHaveBeenCalledWith('user-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('heartbeat_ack', {
        timestamp: expect.any(String),
      });
    });

    it('should not update heartbeat without userId', async () => {
      await gateway.handleHeartbeat(mockSocket);

      expect(presenceService.updateHeartbeat).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinConversation', () => {
    it('should join conversation successfully', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: 'conv-456' };

      await gateway.handleJoinConversation(mockSocket, data);

      expect(mockSocket.join).toHaveBeenCalledWith('conversation:conv-456');
      expect(mockSocket.emit).toHaveBeenCalledWith('joined_conversation', {
        conversationId: 'conv-456',
        timestamp: expect.any(String),
      });
    });

    it('should not join conversation without userId', async () => {
      const data = { conversationId: 'conv-456' };

      await gateway.handleJoinConversation(mockSocket, data);

      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should not join conversation without conversationId', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: '' };

      await gateway.handleJoinConversation(mockSocket, data);

      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveConversation', () => {
    it('should leave conversation successfully', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: 'conv-456' };
      typingService.stopTyping.mockResolvedValue();

      await gateway.handleLeaveConversation(mockSocket, data);

      expect(mockSocket.leave).toHaveBeenCalledWith('conversation:conv-456');
      expect(typingService.stopTyping).toHaveBeenCalledWith('user-123', 'conv-456');
      expect(mockSocket.emit).toHaveBeenCalledWith('left_conversation', {
        conversationId: 'conv-456',
        timestamp: expect.any(String),
      });
    });

    it('should not leave conversation without userId', async () => {
      const data = { conversationId: 'conv-456' };

      await gateway.handleLeaveConversation(mockSocket, data);

      expect(mockSocket.leave).not.toHaveBeenCalled();
    });
  });

  describe('handleStartTyping', () => {
    it('should start typing and broadcast to others', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: 'conv-456' };
      typingService.startTyping.mockResolvedValue();

      const mockTo = {
        emit: jest.fn(),
      };
      mockSocket.to.mockReturnValue(mockTo as any);

      await gateway.handleStartTyping(mockSocket, data);

      expect(typingService.startTyping).toHaveBeenCalledWith('user-123', 'conv-456');
      expect(mockSocket.to).toHaveBeenCalledWith('conversation:conv-456');
      expect(mockTo.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'user-123',
        conversationId: 'conv-456',
        timestamp: expect.any(String),
      });
    });

    it('should not start typing without userId', async () => {
      const data = { conversationId: 'conv-456' };

      await gateway.handleStartTyping(mockSocket, data);

      expect(typingService.startTyping).not.toHaveBeenCalled();
    });
  });

  describe('handleStopTyping', () => {
    it('should stop typing and broadcast to others', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: 'conv-456' };
      typingService.stopTyping.mockResolvedValue();

      const mockTo = {
        emit: jest.fn(),
      };
      mockSocket.to.mockReturnValue(mockTo as any);

      await gateway.handleStopTyping(mockSocket, data);

      expect(typingService.stopTyping).toHaveBeenCalledWith('user-123', 'conv-456');
      expect(mockSocket.to).toHaveBeenCalledWith('conversation:conv-456');
      expect(mockTo.emit).toHaveBeenCalledWith('user_stopped_typing', {
        userId: 'user-123',
        conversationId: 'conv-456',
        timestamp: expect.any(String),
      });
    });
  });

  describe('handleMarkAsRead', () => {
    it('should mark message as read and broadcast', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: 'conv-456', messageId: 'msg-789' };
      readReceiptService.markAsRead.mockResolvedValue();

      const mockTo = {
        emit: jest.fn(),
      };
      mockSocket.to.mockReturnValue(mockTo as any);

      await gateway.handleMarkAsRead(mockSocket, data);

      expect(readReceiptService.markAsRead).toHaveBeenCalledWith('user-123', 'conv-456', 'msg-789');
      expect(mockSocket.to).toHaveBeenCalledWith('conversation:conv-456');
      expect(mockTo.emit).toHaveBeenCalledWith('message_read', {
        userId: 'user-123',
        conversationId: 'conv-456',
        messageId: 'msg-789',
        timestamp: expect.any(String),
      });
    });

    it('should not mark as read without required data', async () => {
      mockSocket.userId = 'user-123';
      const data = { conversationId: 'conv-456', messageId: '' };

      await gateway.handleMarkAsRead(mockSocket, data);

      expect(readReceiptService.markAsRead).not.toHaveBeenCalled();
    });
  });

  describe('handleGetPresence', () => {
    it('should get presence and emit to client', async () => {
      mockSocket.userId = 'user-123';
      const data = { userIds: ['user-456', 'user-789'] };
      const mockPresences = {
        'user-456': { userId: 'user-456', status: 'online' },
        'user-789': { userId: 'user-789', status: 'offline' },
      };
      presenceService.getBulkPresence.mockResolvedValue(mockPresences as any);

      await gateway.handleGetPresence(mockSocket, data);

      expect(presenceService.getBulkPresence).toHaveBeenCalledWith(['user-456', 'user-789']);
      expect(mockSocket.emit).toHaveBeenCalledWith('presence_update', {
        presences: mockPresences,
        timestamp: expect.any(String),
      });
    });

    it('should not get presence without userId', async () => {
      const data = { userIds: ['user-456'] };

      await gateway.handleGetPresence(mockSocket, data);

      expect(presenceService.getBulkPresence).not.toHaveBeenCalled();
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message to conversation participants', async () => {
      const message = { id: 'msg-123', content: 'Hello' };
      const mockTo = {
        emit: jest.fn(),
      };
      mockServer.to.mockReturnValue(mockTo as any);

      await gateway.broadcastMessage('conv-456', message);

      expect(mockServer.to).toHaveBeenCalledWith('conversation:conv-456');
      expect(mockTo.emit).toHaveBeenCalledWith('new_message', {
        ...message,
        timestamp: expect.any(String),
      });
    });
  });

  describe('broadcastConversationUpdate', () => {
    it('should broadcast conversation update to participants', async () => {
      const update = { lastActivity: new Date() };
      const mockTo = {
        emit: jest.fn(),
      };
      mockServer.to.mockReturnValue(mockTo as any);

      await gateway.broadcastConversationUpdate('conv-456', update);

      expect(mockServer.to).toHaveBeenCalledWith('conversation:conv-456');
      expect(mockTo.emit).toHaveBeenCalledWith('conversation_updated', {
        conversationId: 'conv-456',
        ...update,
        timestamp: expect.any(String),
      });
    });
  });

  describe('sendUserNotification', () => {
    it('should send notification to specific user', async () => {
      const notification = { type: 'message', content: 'New message' };
      const mockTo = {
        emit: jest.fn(),
      };
      mockServer.to.mockReturnValue(mockTo as any);

      await gateway.sendUserNotification('user-123', notification);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
      expect(mockTo.emit).toHaveBeenCalledWith('notification', {
        ...notification,
        timestamp: expect.any(String),
      });
    });
  });

  describe('broadcastPresenceUpdate', () => {
    it('should broadcast presence update to all clients', async () => {
      await gateway.broadcastPresenceUpdate('user-123', 'online');

      expect(mockServer.emit).toHaveBeenCalledWith('presence_update', {
        userId: 'user-123',
        status: 'online',
        timestamp: expect.any(String),
      });
    });
  });
});