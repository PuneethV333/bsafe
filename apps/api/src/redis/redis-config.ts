import type { ConfigService } from '@nestjs/config';

export interface RedisConnection {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Resolve the Redis connection for ioredis. When `REDIS_URL` is set (e.g. an
 * Upstash `rediss://…` endpoint) it takes precedence; otherwise the classic
 * `REDIS_HOST` / `REDIS_PORT` pair is used. Shared by RedisService and the
 * BullMQ queue/worker so every consumer talks to the same instance.
 */
export function redisConnection(config: Pick<ConfigService, 'get'>): RedisConnection {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    return { url };
  }
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
  };
}