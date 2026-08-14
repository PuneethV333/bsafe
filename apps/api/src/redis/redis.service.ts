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
    const rawUrl = this.config.get<string>('REDIS_URL') ?? '';
    const sanitized = rawUrl.replace(/:([^:@/]+)@/, ':****@');
    this.logger.log(`REDIS_URL env = "${sanitized}"`);
    this.client = new Redis({
      ...redisConnection(this.config),
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    this.logger.log(
      `Redis connecting to ${this.client.options.host}:${this.client.options.port}`,
    );
    this.client.on('error', (err: unknown) => {
      const addresses = (err as { errors?: Array<{ address?: string; port?: number; code?: string }> })
        ?.errors?.map((e) => `${e.address}:${e.port} (${e.code ?? 'errno'})`)
        .join(', ');
      this.logger.error(
        `ioredis error: ${(err as Error)?.message ?? String(err)}${addresses ? ` -> ${addresses}` : ''}`,
      );
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
