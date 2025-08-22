import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import {
  BatchProfileRequestDto,
  BatchProfileResponseDto,
  UserProfileDto,
  BusinessProfileDto,
} from './dto/profile-response.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly kahaMainV3Url: string;
  private readonly serviceToken: string;
  private readonly profileCacheTtl: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.kahaMainV3Url = this.configService.get<string>('KAHA_MAIN_V3_URL');
    this.serviceToken = this.configService.get<string>('KAHA_MAIN_V3_SERVICE_TOKEN');
    this.profileCacheTtl = this.configService.get<number>('PROFILE_CACHE_TTL', 86400); // 24 hours
  }

  /**
   * Batch fetch profiles from kaha-main-v3 with Redis caching
   */
  async batchFetchProfiles(
    userIds: string[] = [],
    businessIds: string[] = [],
  ): Promise<BatchProfileResponseDto> {
    try {
      // First, try to get profiles from cache
      const cachedResult = await this.getCachedProfiles(userIds, businessIds);
      
      // Determine which profiles are missing from cache
      const missingUserIds = userIds.filter(
        id => !cachedResult.users.find(u => u.uuid === id)
      );
      const missingBusinessIds = businessIds.filter(
        id => !cachedResult.businesses.find(b => b.uuid === id)
      );

      // If all profiles are cached, return cached result
      if (missingUserIds.length === 0 && missingBusinessIds.length === 0) {
        this.logger.debug(`All profiles found in cache`);
        return cachedResult;
      }

      // Fetch missing profiles from kaha-main-v3
      const freshProfiles = await this.fetchFromKahaMainV3(
        missingUserIds,
        missingBusinessIds,
      );

      // Cache the fresh profiles
      await this.cacheProfiles(freshProfiles.users, freshProfiles.businesses);

      // Combine cached and fresh profiles
      return {
        users: [...cachedResult.users, ...freshProfiles.users],
        businesses: [...cachedResult.businesses, ...freshProfiles.businesses],
      };
    } catch (error) {
      this.logger.error(`Failed to batch fetch profiles: ${error.message}`, error.stack);
      
      // Fallback to cached data only (graceful degradation)
      const cachedResult = await this.getCachedProfiles(userIds, businessIds);
      
      // Mark cached profiles as potentially stale
      cachedResult.users.forEach(user => (user as any).is_stale = true);
      cachedResult.businesses.forEach(business => (business as any).is_stale = true);
      
      return cachedResult;
    }
  }

  /**
   * Fetch profiles directly from kaha-main-v3 API
   */
  private async fetchFromKahaMainV3(
    userIds: string[],
    businessIds: string[],
  ): Promise<BatchProfileResponseDto> {
    if (userIds.length === 0 && businessIds.length === 0) {
      return { users: [], businesses: [] };
    }

    const requestBody: BatchProfileRequestDto = {};
    if (userIds.length > 0) requestBody.user_uuids = userIds;
    if (businessIds.length > 0) requestBody.business_uuids = businessIds;

    try {
      const response = await firstValueFrom(
        this.httpService.post<BatchProfileResponseDto>(
          `${this.kahaMainV3Url}/api/batch/profiles`,
          requestBody,
          {
            headers: {
              'Authorization': `Bearer ${this.serviceToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000, // 5 second timeout
          },
        ),
      );

      this.logger.debug(
        `Fetched ${response.data.users.length} users and ${response.data.businesses.length} businesses from kaha-main-v3`
      );

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `kaha-main-v3 API error: ${error.response?.status} - ${error.response?.statusText}`,
          error.response?.data,
        );
      } else {
        this.logger.error(`kaha-main-v3 request failed: ${error.message}`, error.stack);
      }
      throw error;
    }
  }

  /**
   * Get profiles from Redis cache
   */
  private async getCachedProfiles(
    userIds: string[],
    businessIds: string[],
  ): Promise<BatchProfileResponseDto> {
    const users: UserProfileDto[] = [];
    const businesses: BusinessProfileDto[] = [];

    try {
      // Fetch user profiles from cache
      for (const userId of userIds) {
        const cached = await this.redis.hgetall(`profile:user:${userId}`);
        if (cached && cached.uuid) {
          users.push({
            uuid: cached.uuid,
            name: cached.name,
            avatar_url: cached.avatar_url || undefined,
          });
        }
      }

      // Fetch business profiles from cache
      for (const businessId of businessIds) {
        const cached = await this.redis.hgetall(`profile:business:${businessId}`);
        if (cached && cached.uuid) {
          businesses.push({
            uuid: cached.uuid,
            name: cached.name,
            avatar_url: cached.avatar_url || undefined,
          });
        }
      }

      this.logger.debug(
        `Found ${users.length}/${userIds.length} users and ${businesses.length}/${businessIds.length} businesses in cache`
      );
    } catch (error) {
      this.logger.warn(`Failed to get cached profiles: ${error.message}`);
    }

    return { users, businesses };
  }

  /**
   * Cache profiles in Redis
   */
  private async cacheProfiles(
    users: UserProfileDto[],
    businesses: BusinessProfileDto[],
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Cache user profiles
      for (const user of users) {
        const key = `profile:user:${user.uuid}`;
        pipeline.hset(key, {
          uuid: user.uuid,
          name: user.name,
          avatar_url: user.avatar_url || '',
          cached_at: new Date().toISOString(),
        });
        pipeline.expire(key, this.profileCacheTtl);
      }

      // Cache business profiles
      for (const business of businesses) {
        const key = `profile:business:${business.uuid}`;
        pipeline.hset(key, {
          uuid: business.uuid,
          name: business.name,
          avatar_url: business.avatar_url || '',
          cached_at: new Date().toISOString(),
        });
        pipeline.expire(key, this.profileCacheTtl);
      }

      await pipeline.exec();
      
      this.logger.debug(
        `Cached ${users.length} users and ${businesses.length} businesses`
      );
    } catch (error) {
      this.logger.error(`Failed to cache profiles: ${error.message}`, error.stack);
    }
  }

  /**
   * Invalidate cached profile data
   */
  async invalidateProfileCache(userId?: string, businessId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      if (userId) {
        keysToDelete.push(`profile:user:${userId}`);
      }

      if (businessId) {
        keysToDelete.push(`profile:business:${businessId}`);
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
        this.logger.debug(`Invalidated cache for keys: ${keysToDelete.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate profile cache: ${error.message}`, error.stack);
    }
  }

  /**
   * Get a single user profile with caching
   */
  async getUserProfile(userId: string): Promise<UserProfileDto | null> {
    const result = await this.batchFetchProfiles([userId], []);
    return result.users.find(user => user.uuid === userId) || null;
  }

  /**
   * Get a single business profile with caching
   */
  async getBusinessProfile(businessId: string): Promise<BusinessProfileDto | null> {
    const result = await this.batchFetchProfiles([], [businessId]);
    return result.businesses.find(business => business.uuid === businessId) || null;
  }

  /**
   * Enrich conversation data with profile information
   */
  async enrichConversationData(conversations: any[]): Promise<any[]> {
    if (!conversations || conversations.length === 0) {
      return conversations;
    }

    try {
      // Extract unique user and business IDs from conversations
      const userIds = new Set<string>();
      const businessIds = new Set<string>();

      conversations.forEach((conversation: any) => {
        // Add participant user IDs
        if (conversation.participants) {
          conversation.participants.forEach((participant: any) => {
            if (participant.userId) {
              userIds.add(participant.userId);
            }
          });
        }

        // Add business ID if it's a business conversation
        if (conversation.businessId) {
          businessIds.add(conversation.businessId);
        }

        // Add last message sender ID
        if (conversation.lastMessage?.senderId) {
          userIds.add(conversation.lastMessage.senderId);
        }
      });

      // Batch fetch all required profiles
      const profiles = await this.batchFetchProfiles(
        Array.from(userIds),
        Array.from(businessIds),
      );

      // Create lookup maps for quick access
      const userProfileMap = new Map(
        profiles.users.map(user => [user.uuid, user])
      );
      const businessProfileMap = new Map(
        profiles.businesses.map(business => [business.uuid, business])
      );

      // Enrich conversations with profile data
      return conversations.map((conversation: any) => ({
        ...conversation,
        participants: conversation.participants?.map((participant: any) => ({
          ...participant,
          user: participant.userId ? userProfileMap.get(participant.userId) : undefined,
        })),
        business: conversation.businessId ? businessProfileMap.get(conversation.businessId) : undefined,
        lastMessage: conversation.lastMessage ? {
          ...conversation.lastMessage,
          sender: conversation.lastMessage.senderId 
            ? userProfileMap.get(conversation.lastMessage.senderId) 
            : undefined,
        } : undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to enrich conversation data: ${error.message}`, error.stack);
      
      // Return original conversations without enrichment (graceful degradation)
      return conversations;
    }
  }

  /**
   * Enrich message data with sender profile information
   */
  async enrichMessageData(messages: any[]): Promise<any[]> {
    if (!messages || messages.length === 0) {
      return messages;
    }

    try {
      // Extract unique sender IDs
      const senderIds = [...new Set(
        messages
          .map(message => message.senderId)
          .filter(Boolean)
      )];

      if (senderIds.length === 0) {
        return messages;
      }

      // Batch fetch sender profiles
      const profiles = await this.batchFetchProfiles(senderIds, []);
      const userProfileMap = new Map(
        profiles.users.map(user => [user.uuid, user])
      );

      // Enrich messages with sender profile data
      return messages.map(message => ({
        ...message,
        sender: message.senderId ? userProfileMap.get(message.senderId) : undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to enrich message data: ${error.message}`, error.stack);
      
      // Return original messages without enrichment (graceful degradation)
      return messages;
    }
  }
}