import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    this.client = redisUrl ? new Redis(redisUrl) : new Redis();

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (error) => {
      const message = error instanceof Error
        ? (error.message || error.name || 'unknown error')
        : String(error);
      this.logger.error(`Redis error: ${message}`);
      if (error instanceof Error && error.stack) {
        this.logger.debug(error.stack);
      }
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      this.logger.warn('Failed to close Redis connection');
      this.logger.debug(error);
    }
  }
}
