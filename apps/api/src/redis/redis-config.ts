import type { ConfigService } from '@nestjs/config';

export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, unknown>;
}

/**
 * Resolve the Redis connection for ioredis. `REDIS_URL` is required (e.g. an
 * Upstash `rediss://…` endpoint) — there is no localhost fallback so a missing
 * env var fails loudly instead of silently connecting to the wrong instance.
 * Shared by RedisService and the BullMQ queue/worker so every consumer talks
 * to the same instance.
 *
 * ioredis only parses a connection URL when it is passed as a string argument
 * (`new Redis(url)`); a `url` key inside an options object is silently ignored
 * and falls back to `localhost:6379`. We therefore parse the URL into
 * host/port/tls here so it can be spread into an options object for both
 * `new Redis(...)` and BullMQ's `connection` option.
 */
export function redisConnection(config: Pick<ConfigService, 'get'>): RedisConnection {
  const url = config.get<string>('REDIS_URL');
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. Provide a Redis connection URL (e.g. an Upstash rediss:// endpoint).',
    );
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(`REDIS_URL must use redis:// or rediss://, got "${parsed.protocol}//"`);
  }
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}