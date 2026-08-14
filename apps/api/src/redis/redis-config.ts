import type { ConfigService } from '@nestjs/config';

export interface RedisConnection {
  url: string;
}

/**
 * Resolve the Redis connection for ioredis. `REDIS_URL` is required (e.g. an
 * Upstash `rediss://…` endpoint) — there is no localhost fallback so a missing
 * env var fails loudly instead of silently connecting to the wrong instance.
 * Shared by RedisService and the BullMQ queue/worker so every consumer talks
 * to the same instance.
 */
export function redisConnection(config: Pick<ConfigService, 'get'>): RedisConnection {
  const url = config.get<string>('REDIS_URL');
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. Provide a Redis connection URL (e.g. an Upstash rediss:// endpoint).',
    );
  }
  return { url };
}