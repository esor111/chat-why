import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ProfileService } from './profile.service';
import { REDIS_CLIENT } from '../database/redis.module';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import {
  BatchProfileResponseDto,
  UserProfileDto,
  BusinessProfileDto,
} from './dto/profile-response.dto';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpService: jest.Mocked<HttpService>;
  let redis: jest.Mocked<any>;
  let configService: jest.Mocked<ConfigService>;

  const mockUserProfile: UserProfileDto = {
    uuid: 'user-123',
    name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg',
  };

  const mockBusinessProfile: BusinessProfileDto = {
    uuid: 'business-123',
    name: 'Test Business',
    avatar_url: 'https://example.com/business.jpg',
  };

  const mockBatchResponse: BatchProfileResponseDto = {
    users: [mockUserProfile],
    businesses: [mockBusinessProfile],
  };

  beforeEach(async () => {
    const mockRedis = {
      hgetall: jest.fn(),
      hset: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockHttpService = {
      post: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
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

    service = module.get<ProfileService>(ProfileService);
    httpService = module.get(HttpService);
    redis = module.get(REDIS_CLIENT);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      switch (key) {
        case 'KAHA_MAIN_V3_URL':
          return 'https://api.example.com';
        case 'KAHA_MAIN_V3_SERVICE_TOKEN':
          return 'test-token';
        case 'PROFILE_CACHE_TTL':
          return defaultValue || 86400;
        default:
          return defaultValue;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('batchFetchProfiles', () => {
    it('should return cached profiles when all are available', async () => {
      // Mock cached user profile
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'profile:user:user-123') {
          return Promise.resolve({
            uuid: 'user-123',
            name: 'John Doe',
            avatar_url: 'https://example.com/avatar.jpg',
          });
        }
        if (key === 'profile:business:business-123') {
          return Promise.resolve({
            uuid: 'business-123',
            name: 'Test Business',
            avatar_url: 'https://example.com/business.jpg',
          });
        }
        return Promise.resolve({});
      });

      const result = await service.batchFetchProfiles(['user-123'], ['business-123']);

      expect(result).toEqual(mockBatchResponse);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch missing profiles from kaha-main-v3', async () => {
      // Mock no cached profiles
      redis.hgetall.mockResolvedValue({});

      // Mock HTTP response
      const axiosResponse: AxiosResponse<BatchProfileResponseDto> = {
        data: mockBatchResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.batchFetchProfiles(['user-123'], ['business-123']);

      expect(result).toEqual(mockBatchResponse);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.example.com/api/batch/profiles',
        {
          user_uuids: ['user-123'],
          business_uuids: ['business-123'],
        },
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    });

    it('should handle kaha-main-v3 API errors gracefully', async () => {
      // Mock cached profiles
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'profile:user:user-123') {
          return Promise.resolve({
            uuid: 'user-123',
            name: 'John Doe',
            avatar_url: 'https://example.com/avatar.jpg',
          });
        }
        return Promise.resolve({});
      });

      // Mock HTTP error
      const axiosError = new AxiosError('Network Error');
      httpService.post.mockReturnValue(throwError(() => axiosError));

      const result = await service.batchFetchProfiles(['user-123'], ['business-123']);

      // Should return cached data with stale flag
      expect(result.users).toHaveLength(1);
      expect(result.users[0].uuid).toBe('user-123');
      expect((result.users[0] as any).is_stale).toBe(true);
    });

    it('should return empty arrays when no IDs provided', async () => {
      const result = await service.batchFetchProfiles([], []);

      expect(result).toEqual({ users: [], businesses: [] });
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile when found', async () => {
      redis.hgetall.mockResolvedValue({
        uuid: 'user-123',
        name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      });

      const result = await service.getUserProfile('user-123');

      expect(result).toEqual(mockUserProfile);
    });

    it('should return null when user not found', async () => {
      redis.hgetall.mockResolvedValue({});
      httpService.post.mockReturnValue(of({
        data: { users: [], businesses: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));

      const result = await service.getUserProfile('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getBusinessProfile', () => {
    it('should return business profile when found', async () => {
      redis.hgetall.mockResolvedValue({
        uuid: 'business-123',
        name: 'Test Business',
        avatar_url: 'https://example.com/business.jpg',
      });

      const result = await service.getBusinessProfile('business-123');

      expect(result).toEqual(mockBusinessProfile);
    });

    it('should return null when business not found', async () => {
      redis.hgetall.mockResolvedValue({});
      httpService.post.mockReturnValue(of({
        data: { users: [], businesses: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));

      const result = await service.getBusinessProfile('business-123');

      expect(result).toBeNull();
    });
  });

  describe('invalidateProfileCache', () => {
    it('should delete user profile cache', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateProfileCache('user-123');

      expect(redis.del).toHaveBeenCalledWith('profile:user:user-123');
    });

    it('should delete business profile cache', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateProfileCache(undefined, 'business-123');

      expect(redis.del).toHaveBeenCalledWith('profile:business:business-123');
    });

    it('should delete both user and business profile cache', async () => {
      redis.del.mockResolvedValue(2);

      await service.invalidateProfileCache('user-123', 'business-123');

      expect(redis.del).toHaveBeenCalledWith(
        'profile:user:user-123',
        'profile:business:business-123'
      );
    });

    it('should handle Redis errors gracefully', async () => {
      redis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        service.invalidateProfileCache('user-123')
      ).resolves.not.toThrow();
    });
  });

  describe('enrichConversationData', () => {
    it('should enrich conversations with profile data', async () => {
      const conversations = [
        {
          id: 'conv-123',
          participants: [
            { userId: 'user-123', role: 'member' },
            { userId: 'user-456', role: 'member' },
          ],
          businessId: 'business-123',
          lastMessage: {
            id: 'msg-123',
            senderId: 'user-123',
            content: 'Hello',
          },
        },
      ];

      // Mock cached profiles
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'profile:user:user-123') {
          return Promise.resolve({
            uuid: 'user-123',
            name: 'John Doe',
            avatar_url: 'https://example.com/avatar.jpg',
          });
        }
        if (key === 'profile:user:user-456') {
          return Promise.resolve({
            uuid: 'user-456',
            name: 'Jane Smith',
            avatar_url: 'https://example.com/jane.jpg',
          });
        }
        if (key === 'profile:business:business-123') {
          return Promise.resolve({
            uuid: 'business-123',
            name: 'Test Business',
            avatar_url: 'https://example.com/business.jpg',
          });
        }
        return Promise.resolve({});
      });

      const result = await service.enrichConversationData(conversations);

      expect(result).toHaveLength(1);
      expect(result[0].participants[0].user).toEqual({
        uuid: 'user-123',
        name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      });
      expect(result[0].business).toEqual({
        uuid: 'business-123',
        name: 'Test Business',
        avatar_url: 'https://example.com/business.jpg',
      });
      expect(result[0].lastMessage.sender).toEqual({
        uuid: 'user-123',
        name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      });
    });

    it('should return original conversations when enrichment fails', async () => {
      const conversations = [{ id: 'conv-123', participants: [] }];
      
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      const result = await service.enrichConversationData(conversations);

      expect(result).toEqual(conversations);
    });

    it('should handle empty conversations array', async () => {
      const result = await service.enrichConversationData([]);

      expect(result).toEqual([]);
    });
  });

  describe('enrichMessageData', () => {
    it('should enrich messages with sender profile data', async () => {
      const messages = [
        {
          id: 'msg-123',
          senderId: 'user-123',
          content: 'Hello',
        },
        {
          id: 'msg-456',
          senderId: 'user-456',
          content: 'Hi there',
        },
      ];

      // Mock cached profiles
      redis.hgetall.mockImplementation((key: string) => {
        if (key === 'profile:user:user-123') {
          return Promise.resolve({
            uuid: 'user-123',
            name: 'John Doe',
            avatar_url: 'https://example.com/avatar.jpg',
          });
        }
        if (key === 'profile:user:user-456') {
          return Promise.resolve({
            uuid: 'user-456',
            name: 'Jane Smith',
            avatar_url: 'https://example.com/jane.jpg',
          });
        }
        return Promise.resolve({});
      });

      const result = await service.enrichMessageData(messages);

      expect(result).toHaveLength(2);
      expect(result[0].sender).toEqual({
        uuid: 'user-123',
        name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      });
      expect(result[1].sender).toEqual({
        uuid: 'user-456',
        name: 'Jane Smith',
        avatar_url: 'https://example.com/jane.jpg',
      });
    });

    it('should return original messages when enrichment fails', async () => {
      const messages = [{ id: 'msg-123', senderId: 'user-123', content: 'Hello' }];
      
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      const result = await service.enrichMessageData(messages);

      expect(result).toEqual(messages);
    });

    it('should handle empty messages array', async () => {
      const result = await service.enrichMessageData([]);

      expect(result).toEqual([]);
    });

    it('should handle messages without sender IDs', async () => {
      const messages = [
        { id: 'msg-123', content: 'System message' },
        { id: 'msg-456', senderId: null, content: 'Another message' },
      ];

      const result = await service.enrichMessageData(messages);

      expect(result).toEqual(messages);
    });
  });
});