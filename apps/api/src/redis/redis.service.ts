import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConnection } from './redis-config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      ...redisConnection(this.config),
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    await this.client.ping();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  get redis(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
