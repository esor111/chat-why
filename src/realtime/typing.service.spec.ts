import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TypingService, TypingIndicator } from './typing.service';
import { REDIS_CLIENT } from '../database/redis.module';

describe('TypingService', () => {
  let service: TypingService;
  let redis: jest.Mocked<any>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockRedis = {
      hset: jest.fn(),
      hgetall: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      expire: jest.fn(),
      exists: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypingService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TypingService>(TypingService);
    redis = module.get(REDIS_CLIENT);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockReturnValue(5); // Default typing timeout
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startTyping', () => {
    it('should start typing indicator for user', async () => {
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.startTyping('user-123', 'conv-456');

      expect(redis.hset).toHaveBeenCalledWith(
        'typing:conv-456:user-123',
        expect.objectContaining({
          userId: 'user-123',
          conversationId: 'conv-456',
          startedAt: expect.any(String),
          expiresAt: expect.any(String),
        })
      );
      expect(redis.expire).toHaveBeenCalledWith('typing:conv-456:user-123', 5);
    });

    it('should handle Redis errors gracefully', async () => {
      redis.hset.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        service.startTyping('user-123', 'conv-456')
      ).resolves.not.toThrow();
    });
  });

  describe('stopTyping', () => {
    it('should stop typing indicator for user', async () => {
      redis.del.mockResolvedValue(1);

      await service.stopTyping('user-123', 'conv-456');

      expect(redis.del).toHaveBeenCalledWith('typing:conv-456:user-123');
    });

    it('should handle Redis errors gracefully', async () => {
      redis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        service.stopTyping('user-123', 'conv-456')
      ).resolves.not.toThrow();
    });
  });

  describe('getTypingUsers', () => {
    it('should return typing users for conversation', async () => {
      const futureDate = new Date(Date.now() + 10000); // 10 seconds in future
      
      redis.keys.mockResolvedValue(['typing:conv-456:user-123', 'typing:conv-456:user-789']);
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'typing:conv-456:user-123') {
          return Promise.resolve({
            userId: 'user-123',
            conversationId: 'conv-456',
            expiresAt: futureDate.toISOString(),
          });
        }
        if (key === 'typing:conv-456:user-789') {
          return Promise.resolve({
            userId: 'user-789',
            conversationId: 'conv-456',
            expiresAt: futureDate.toISOString(),
          });
        }
        return Promise.resolve({});
      });

      const result = await service.getTypingUsers('conv-456');

      expect(result).toEqual(['user-123', 'user-789']);
    });

    it('should filter out expired typing indicators', async () => {
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago
      const futureDate = new Date(Date.now() + 10000); // 10 seconds in future
      
      redis.keys.mockResolvedValue(['typing:conv-456:user-123', 'typing:conv-456:user-789']);
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'typing:conv-456:user-123') {
          return Promise.resolve({
            userId: 'user-123',
            conversationId: 'conv-456',
            expiresAt: pastDate.toISOString(), // Expired
          });
        }
        if (key === 'typing:conv-456:user-789') {
          return Promise.resolve({
            userId: 'user-789',
            conversationId: 'conv-456',
            expiresAt: futureDate.toISOString(), // Valid
          });
        }
        return Promise.resolve({});
      });
      redis.del.mockResolvedValue(1);

      const result = await service.getTypingUsers('conv-456');

      expect(result).toEqual(['user-789']);
      expect(redis.del).toHaveBeenCalledWith('typing:conv-456:user-123');
    });

    it('should return empty array when Redis fails', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.getTypingUsers('conv-456');

      expect(result).toEqual([]);
    });
  });

  describe('isUserTyping', () => {
    it('should return true when user is typing', async () => {
      const futureDate = new Date(Date.now() + 10000);
      
      redis.hgetall.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-456',
        expiresAt: futureDate.toISOString(),
      });

      const result = await service.isUserTyping('user-123', 'conv-456');

      expect(result).toBe(true);
    });

    it('should return false when typing indicator expired', async () => {
      const pastDate = new Date(Date.now() - 10000);
      
      redis.hgetall.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-456',
        expiresAt: pastDate.toISOString(),
      });
      redis.del.mockResolvedValue(1);

      const result = await service.isUserTyping('user-123', 'conv-456');

      expect(result).toBe(false);
      expect(redis.del).toHaveBeenCalledWith('typing:conv-456:user-123');
    });

    it('should return false when no typing indicator exists', async () => {
      redis.hgetall.mockResolvedValue({});

      const result = await service.isUserTyping('user-123', 'conv-456');

      expect(result).toBe(false);
    });

    it('should return false when Redis fails', async () => {
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      const result = await service.isUserTyping('user-123', 'conv-456');

      expect(result).toBe(false);
    });
  });

  describe('getBulkTypingUsers', () => {
    it('should return typing users for multiple conversations', async () => {
      const futureDate = new Date(Date.now() + 10000);
      
      // Mock getTypingUsers calls
      jest.spyOn(service, 'getTypingUsers').mockImplementation((conversationId: string) => {
        if (conversationId === 'conv-123') {
          return Promise.resolve(['user-123']);
        }
        if (conversationId === 'conv-456') {
          return Promise.resolve(['user-456', 'user-789']);
        }
        return Promise.resolve([]);
      });

      const result = await service.getBulkTypingUsers(['conv-123', 'conv-456']);

      expect(result).toEqual({
        'conv-123': ['user-123'],
        'conv-456': ['user-456', 'user-789'],
      });
    });
  });

  describe('extendTyping', () => {
    it('should extend existing typing indicator', async () => {
      redis.exists.mockResolvedValue(1);
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.extendTyping('user-123', 'conv-456');

      expect(redis.hset).toHaveBeenCalledWith(
        'typing:conv-456:user-123',
        expect.objectContaining({
          expiresAt: expect.any(String),
        })
      );
      expect(redis.expire).toHaveBeenCalledWith('typing:conv-456:user-123', 5);
    });

    it('should start typing if not already typing', async () => {
      redis.exists.mockResolvedValue(0);
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.extendTyping('user-123', 'conv-456');

      // Should call startTyping logic
      expect(redis.hset).toHaveBeenCalledWith(
        'typing:conv-456:user-123',
        expect.objectContaining({
          userId: 'user-123',
          conversationId: 'conv-456',
          startedAt: expect.any(String),
          expiresAt: expect.any(String),
        })
      );
    });
  });

  describe('stopAllTypingForUser', () => {
    it('should stop all typing indicators for user', async () => {
      redis.keys.mockResolvedValue(['typing:conv-123:user-123', 'typing:conv-456:user-123']);
      redis.del.mockResolvedValue(2);

      await service.stopAllTypingForUser('user-123');

      expect(redis.del).toHaveBeenCalledWith(
        'typing:conv-123:user-123',
        'typing:conv-456:user-123'
      );
    });

    it('should handle no typing indicators gracefully', async () => {
      redis.keys.mockResolvedValue([]);

      await service.stopAllTypingForUser('user-123');

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('getTypingStats', () => {
    it('should return typing statistics', async () => {
      const futureDate = new Date(Date.now() + 10000);
      
      redis.keys.mockResolvedValue([
        'typing:conv-123:user-123',
        'typing:conv-456:user-456',
        'typing:conv-456:user-789',
      ]);
      
      redis.hgetall.mockImplementation((key: string) => {
        return Promise.resolve({
          conversationId: key.includes('conv-123') ? 'conv-123' : 'conv-456',
          expiresAt: futureDate.toISOString(),
        });
      });

      const result = await service.getTypingStats();

      expect(result).toEqual({
        activeIndicators: 3,
        conversationsWithTyping: 2,
      });
    });

    it('should filter out expired indicators', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const futureDate = new Date(Date.now() + 10000);
      
      redis.keys.mockResolvedValue([
        'typing:conv-123:user-123',
        'typing:conv-456:user-456',
      ]);
      
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'typing:conv-123:user-123') {
          return Promise.resolve({
            conversationId: 'conv-123',
            expiresAt: pastDate.toISOString(), // Expired
          });
        }
        return Promise.resolve({
          conversationId: 'conv-456',
          expiresAt: futureDate.toISOString(), // Valid
        });
      });
      redis.del.mockResolvedValue(1);

      const result = await service.getTypingStats();

      expect(result).toEqual({
        activeIndicators: 1,
        conversationsWithTyping: 1,
      });
      expect(redis.del).toHaveBeenCalledWith('typing:conv-123:user-123');
    });
  });

  describe('cleanupExpiredTypingIndicators', () => {
    it('should cleanup expired typing indicators', async () => {
      const pastDate = new Date(Date.now() - 10000);
      
      redis.keys.mockResolvedValue(['typing:conv-123:user-123']);
      redis.hgetall.mockResolvedValue({
        expiresAt: pastDate.toISOString(),
      });
      redis.del.mockResolvedValue(1);

      await service.cleanupExpiredTypingIndicators();

      expect(redis.del).toHaveBeenCalledWith('typing:conv-123:user-123');
    });

    it('should cleanup empty keys', async () => {
      redis.keys.mockResolvedValue(['typing:conv-123:user-123']);
      redis.hgetall.mockResolvedValue({});
      redis.del.mockResolvedValue(1);

      await service.cleanupExpiredTypingIndicators();

      expect(redis.del).toHaveBeenCalledWith('typing:conv-123:user-123');
    });

    it('should handle errors gracefully', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.cleanupExpiredTypingIndicators()).resolves.not.toThrow();
    });
  });

  describe('getTypingIndicators', () => {
    it('should return typing indicators with details', async () => {
      const futureDate = new Date(Date.now() + 10000);
      const startDate = new Date(Date.now() - 1000);
      
      redis.keys.mockResolvedValue(['typing:conv-456:user-123']);
      redis.hgetall.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-456',
        startedAt: startDate.toISOString(),
        expiresAt: futureDate.toISOString(),
      });

      const result = await service.getTypingIndicators('conv-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: 'user-123',
        conversationId: 'conv-456',
        startedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      });
    });

    it('should filter out expired indicators', async () => {
      const pastDate = new Date(Date.now() - 10000);
      
      redis.keys.mockResolvedValue(['typing:conv-456:user-123']);
      redis.hgetall.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-456',
        startedAt: pastDate.toISOString(),
        expiresAt: pastDate.toISOString(),
      });
      redis.del.mockResolvedValue(1);

      const result = await service.getTypingIndicators('conv-456');

      expect(result).toHaveLength(0);
      expect(redis.del).toHaveBeenCalledWith('typing:conv-456:user-123');
    });

    it('should return empty array when Redis fails', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.getTypingIndicators('conv-456');

      expect(result).toEqual([]);
    });
  });
});