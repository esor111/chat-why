import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
}

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  lastHeartbeat: Date;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly heartbeatTimeout: number;
  private readonly awayTimeout: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.heartbeatTimeout = this.configService.get<number>('PRESENCE_HEARTBEAT_TIMEOUT', 30); // 30 seconds
    this.awayTimeout = this.configService.get<number>('PRESENCE_AWAY_TIMEOUT', 300); // 5 minutes
  }

  /**
   * Set user as online
   */
  async setUserOnline(userId: string): Promise<void> {
    try {
      const now = new Date();
      const presence: UserPresence = {
        userId,
        status: PresenceStatus.ONLINE,
        lastSeen: now,
        lastHeartbeat: now,
      };

      const key = `presence:${userId}`;
      await this.redis.hset(key, {
        status: presence.status,
        lastSeen: presence.lastSeen.toISOString(),
        lastHeartbeat: presence.lastHeartbeat.toISOString(),
      });
      
      // Set expiration for cleanup
      await this.redis.expire(key, this.heartbeatTimeout * 3);

      this.logger.debug(`Set user ${userId} as online`);
    } catch (error) {
      this.logger.error(`Failed to set user online: ${error.message}`, error.stack);
    }
  }

  /**
   * Set user as offline
   */
  async setUserOffline(userId: string): Promise<void> {
    try {
      const key = `presence:${userId}`;
      const now = new Date();

      await this.redis.hset(key, {
        status: PresenceStatus.OFFLINE,
        lastSeen: now.toISOString(),
      });

      // Keep offline status for a while for last seen info
      await this.redis.expire(key, 86400); // 24 hours

      this.logger.debug(`Set user ${userId} as offline`);
    } catch (error) {
      this.logger.error(`Failed to set user offline: ${error.message}`, error.stack);
    }
  }

  /**
   * Update user's heartbeat
   */
  async updateHeartbeat(userId: string): Promise<void> {
    try {
      const key = `presence:${userId}`;
      const now = new Date();

      // Check if user exists in presence
      const exists = await this.redis.exists(key);
      if (!exists) {
        // User not in presence, set as online
        await this.setUserOnline(userId);
        return;
      }

      await this.redis.hset(key, {
        status: PresenceStatus.ONLINE,
        lastHeartbeat: now.toISOString(),
        lastSeen: now.toISOString(),
      });

      // Refresh expiration
      await this.redis.expire(key, this.heartbeatTimeout * 3);

      this.logger.debug(`Updated heartbeat for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to update heartbeat: ${error.message}`, error.stack);
    }
  }

  /**
   * Get user's presence status
   */
  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      const key = `presence:${userId}`;
      const data = await this.redis.hgetall(key);

      if (!data || !data.status) {
        return null;
      }

      return {
        userId,
        status: data.status as PresenceStatus,
        lastSeen: new Date(data.lastSeen),
        lastHeartbeat: data.lastHeartbeat ? new Date(data.lastHeartbeat) : new Date(data.lastSeen),
      };
    } catch (error) {
      this.logger.error(`Failed to get user presence: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get presence for multiple users
   */
  async getBulkPresence(userIds: string[]): Promise<{ [userId: string]: UserPresence }> {
    const presences: { [userId: string]: UserPresence } = {};

    try {
      const pipeline = this.redis.pipeline();
      
      // Queue all presence requests
      userIds.forEach(userId => {
        pipeline.hgetall(`presence:${userId}`);
      });

      const results = await pipeline.exec();

      // Process results
      results?.forEach((result, index) => {
        const userId = userIds[index];
        const [error, data] = result;

        if (!error && data && (data as any).status) {
          const presenceData = data as any;
          presences[userId] = {
            userId,
            status: presenceData.status as PresenceStatus,
            lastSeen: new Date(presenceData.lastSeen),
            lastHeartbeat: presenceData.lastHeartbeat 
              ? new Date(presenceData.lastHeartbeat) 
              : new Date(presenceData.lastSeen),
          };
        }
      });
    } catch (error) {
      this.logger.error(`Failed to get bulk presence: ${error.message}`, error.stack);
    }

    return presences;
  }

  /**
   * Get online users count
   */
  async getOnlineUsersCount(): Promise<number> {
    try {
      const pattern = 'presence:*';
      const keys = await this.redis.keys(pattern);
      
      let onlineCount = 0;
      const pipeline = this.redis.pipeline();
      
      keys.forEach(key => {
        pipeline.hget(key, 'status');
      });

      const results = await pipeline.exec();
      
      results?.forEach(result => {
        const [error, status] = result;
        if (!error && status === PresenceStatus.ONLINE) {
          onlineCount++;
        }
      });

      return onlineCount;
    } catch (error) {
      this.logger.error(`Failed to get online users count: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Set user as away due to inactivity
   */
  async setUserAway(userId: string): Promise<void> {
    try {
      const key = `presence:${userId}`;
      const presence = await this.getUserPresence(userId);

      if (presence && presence.status === PresenceStatus.ONLINE) {
        await this.redis.hset(key, {
          status: PresenceStatus.AWAY,
        });

        this.logger.debug(`Set user ${userId} as away due to inactivity`);
      }
    } catch (error) {
      this.logger.error(`Failed to set user away: ${error.message}`, error.stack);
    }
  }

  /**
   * Background job to check for inactive users and update their status
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkInactiveUsers(): Promise<void> {
    try {
      const pattern = 'presence:*';
      const keys = await this.redis.keys(pattern);
      
      const now = Date.now();
      let updatedCount = 0;

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        
        if (data && data.status && data.lastHeartbeat) {
          const lastHeartbeat = new Date(data.lastHeartbeat).getTime();
          const timeSinceHeartbeat = (now - lastHeartbeat) / 1000; // seconds

          // Set as offline if no heartbeat for more than timeout
          if (data.status === PresenceStatus.ONLINE && timeSinceHeartbeat > this.heartbeatTimeout) {
            const userId = key.replace('presence:', '');
            await this.setUserOffline(userId);
            updatedCount++;
          }
          // Set as away if inactive for more than away timeout
          else if (data.status === PresenceStatus.ONLINE && timeSinceHeartbeat > this.awayTimeout) {
            const userId = key.replace('presence:', '');
            await this.setUserAway(userId);
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        this.logger.debug(`Updated status for ${updatedCount} inactive users`);
      }
    } catch (error) {
      this.logger.error(`Failed to check inactive users: ${error.message}`, error.stack);
    }
  }

  /**
   * Cleanup old presence data
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldPresence(): Promise<void> {
    try {
      const pattern = 'presence:*';
      const keys = await this.redis.keys(pattern);
      
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      let cleanedCount = 0;

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        
        if (data && data.lastSeen) {
          const lastSeen = new Date(data.lastSeen).getTime();
          const age = now - lastSeen;

          // Remove presence data older than max age
          if (age > maxAge) {
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} old presence records`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old presence: ${error.message}`, error.stack);
    }
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats(): Promise<{
    online: number;
    away: number;
    offline: number;
    total: number;
  }> {
    try {
      const pattern = 'presence:*';
      const keys = await this.redis.keys(pattern);
      
      const stats = {
        online: 0,
        away: 0,
        offline: 0,
        total: keys.length,
      };

      const pipeline = this.redis.pipeline();
      keys.forEach(key => {
        pipeline.hget(key, 'status');
      });

      const results = await pipeline.exec();
      
      results?.forEach(result => {
        const [error, status] = result;
        if (!error && status) {
          switch (status) {
            case PresenceStatus.ONLINE:
              stats.online++;
              break;
            case PresenceStatus.AWAY:
              stats.away++;
              break;
            case PresenceStatus.OFFLINE:
              stats.offline++;
              break;
          }
        }
      });

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get presence stats: ${error.message}`, error.stack);
      return { online: 0, away: 0, offline: 0, total: 0 };
    }
  }
}