import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const PREFIX = 'bsafe:cache:';

/**
 * Thin JSON cache over Redis. Reads are 30–60s TTL; writes must explicitly
 * invalidate affected keys (see `del` / `delByPrefix`).
 */
@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.redis.get(PREFIX + key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.redis.set(PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.redis.del(PREFIX + key);
  }

  /** Delete every key whose stored name starts with `prefix` (e.g. `contacts:`). */
  async delByPrefix(prefix: string): Promise<void> {
    const client = this.redis.redis;
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', `${PREFIX}${prefix}*`, 'COUNT', 200);
      if (keys.length) await client.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  }
}