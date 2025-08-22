import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PresenceService, PresenceStatus, UserPresence } from './presence.service';
import { REDIS_CLIENT } from '../database/redis.module';

describe('PresenceService', () => {
  let service: PresenceService;
  let redis: jest.Mocked<any>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockRedis = {
      hset: jest.fn(),
      hgetall: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        hgetall: jest.fn().mockReturnThis(),
        hget: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
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

    service = module.get<PresenceService>(PresenceService);
    redis = module.get(REDIS_CLIENT);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockReturnValue(30); // Default heartbeat timeout
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setUserOnline', () => {
    it('should set user as online', async () => {
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.setUserOnline('user-123');

      expect(redis.hset).toHaveBeenCalledWith(
        'presence:user-123',
        expect.objectContaining({
          status: PresenceStatus.ONLINE,
          lastSeen: expect.any(String),
          lastHeartbeat: expect.any(String),
        })
      );
      expect(redis.expire).toHaveBeenCalledWith('presence:user-123', 90); // 30 * 3
    });

    it('should handle Redis errors gracefully', async () => {
      redis.hset.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.setUserOnline('user-123')).resolves.not.toThrow();
    });
  });

  describe('setUserOffline', () => {
    it('should set user as offline', async () => {
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.setUserOffline('user-123');

      expect(redis.hset).toHaveBeenCalledWith(
        'presence:user-123',
        expect.objectContaining({
          status: PresenceStatus.OFFLINE,
          lastSeen: expect.any(String),
        })
      );
      expect(redis.expire).toHaveBeenCalledWith('presence:user-123', 86400); // 24 hours
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat for existing user', async () => {
      redis.exists.mockResolvedValue(1);
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.updateHeartbeat('user-123');

      expect(redis.hset).toHaveBeenCalledWith(
        'presence:user-123',
        expect.objectContaining({
          status: PresenceStatus.ONLINE,
          lastHeartbeat: expect.any(String),
          lastSeen: expect.any(String),
        })
      );
      expect(redis.expire).toHaveBeenCalledWith('presence:user-123', 90);
    });

    it('should set user online if not in presence', async () => {
      redis.exists.mockResolvedValue(0);
      redis.hset.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await service.updateHeartbeat('user-123');

      // Should call setUserOnline logic
      expect(redis.hset).toHaveBeenCalledWith(
        'presence:user-123',
        expect.objectContaining({
          status: PresenceStatus.ONLINE,
        })
      );
    });
  });

  describe('getUserPresence', () => {
    it('should return user presence when found', async () => {
      const mockPresenceData = {
        status: PresenceStatus.ONLINE,
        lastSeen: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
      };

      redis.hgetall.mockResolvedValue(mockPresenceData);

      const result = await service.getUserPresence('user-123');

      expect(result).toEqual({
        userId: 'user-123',
        status: PresenceStatus.ONLINE,
        lastSeen: expect.any(Date),
        lastHeartbeat: expect.any(Date),
      });
    });

    it('should return null when user not found', async () => {
      redis.hgetall.mockResolvedValue({});

      const result = await service.getUserPresence('user-123');

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      const result = await service.getUserPresence('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getBulkPresence', () => {
    it('should return presence for multiple users', async () => {
      const mockPipeline = {
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, { status: PresenceStatus.ONLINE, lastSeen: new Date().toISOString() }],
          [null, { status: PresenceStatus.OFFLINE, lastSeen: new Date().toISOString() }],
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getBulkPresence(['user-123', 'user-456']);

      expect(result).toHaveProperty('user-123');
      expect(result).toHaveProperty('user-456');
      expect(result['user-123'].status).toBe(PresenceStatus.ONLINE);
      expect(result['user-456'].status).toBe(PresenceStatus.OFFLINE);
    });

    it('should handle pipeline errors gracefully', async () => {
      const mockPipeline = {
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Pipeline error')),
      };

      redis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getBulkPresence(['user-123']);

      expect(result).toEqual({});
    });
  });

  describe('getOnlineUsersCount', () => {
    it('should return count of online users', async () => {
      redis.keys.mockResolvedValue(['presence:user-123', 'presence:user-456']);
      
      const mockPipeline = {
        hget: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, PresenceStatus.ONLINE],
          [null, PresenceStatus.OFFLINE],
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getOnlineUsersCount();

      expect(result).toBe(1);
    });

    it('should return 0 when Redis fails', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.getOnlineUsersCount();

      expect(result).toBe(0);
    });
  });

  describe('setUserAway', () => {
    it('should set online user as away', async () => {
      const mockPresence: UserPresence = {
        userId: 'user-123',
        status: PresenceStatus.ONLINE,
        lastSeen: new Date(),
        lastHeartbeat: new Date(),
      };

      redis.hgetall.mockResolvedValue({
        status: PresenceStatus.ONLINE,
        lastSeen: mockPresence.lastSeen.toISOString(),
        lastHeartbeat: mockPresence.lastHeartbeat.toISOString(),
      });
      redis.hset.mockResolvedValue(1);

      await service.setUserAway('user-123');

      expect(redis.hset).toHaveBeenCalledWith('presence:user-123', {
        status: PresenceStatus.AWAY,
      });
    });

    it('should not update status if user is not online', async () => {
      redis.hgetall.mockResolvedValue({
        status: PresenceStatus.OFFLINE,
        lastSeen: new Date().toISOString(),
      });

      await service.setUserAway('user-123');

      expect(redis.hset).not.toHaveBeenCalled();
    });
  });

  describe('getPresenceStats', () => {
    it('should return presence statistics', async () => {
      redis.keys.mockResolvedValue(['presence:user-123', 'presence:user-456', 'presence:user-789']);
      
      const mockPipeline = {
        hget: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, PresenceStatus.ONLINE],
          [null, PresenceStatus.AWAY],
          [null, PresenceStatus.OFFLINE],
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getPresenceStats();

      expect(result).toEqual({
        online: 1,
        away: 1,
        offline: 1,
        total: 3,
      });
    });

    it('should return zero stats when Redis fails', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.getPresenceStats();

      expect(result).toEqual({
        online: 0,
        away: 0,
        offline: 0,
        total: 0,
      });
    });
  });

  describe('checkInactiveUsers', () => {
    it('should update inactive users to offline', async () => {
      const oldDate = new Date(Date.now() - 60000); // 1 minute ago
      
      redis.keys.mockResolvedValue(['presence:user-123']);
      redis.hgetall.mockResolvedValue({
        status: PresenceStatus.ONLINE,
        lastHeartbeat: oldDate.toISOString(),
      });
      
      // Mock setUserOffline method
      jest.spyOn(service, 'setUserOffline').mockResolvedValue();

      await service.checkInactiveUsers();

      expect(service.setUserOffline).toHaveBeenCalledWith('user-123');
    });

    it('should handle errors gracefully', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.checkInactiveUsers()).resolves.not.toThrow();
    });
  });

  describe('cleanupOldPresence', () => {
    it('should cleanup old presence data', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      
      redis.keys.mockResolvedValue(['presence:user-123']);
      redis.hgetall.mockResolvedValue({
        status: PresenceStatus.OFFLINE,
        lastSeen: oldDate.toISOString(),
      });
      redis.del.mockResolvedValue(1);

      await service.cleanupOldPresence();

      expect(redis.del).toHaveBeenCalledWith('presence:user-123');
    });

    it('should handle errors gracefully', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.cleanupOldPresence()).resolves.not.toThrow();
    });
  });
});