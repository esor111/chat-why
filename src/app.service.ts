import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './database/redis.module';

@Injectable()
export class AppService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getDetailedHealth() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chat-backend',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: 'unknown',
        connected: false,
      },
      redis: {
        status: 'unknown',
        connected: false,
      },
    };

    // Check database connection
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        health.database.status = 'ok';
        health.database.connected = true;
      }
    } catch (error) {
      health.database.status = 'error';
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      await this.redis.ping();
      health.redis.status = 'ok';
      health.redis.connected = true;
    } catch (error) {
      health.redis.status = 'error';
      health.status = 'degraded';
    }

    return health;
  }
}