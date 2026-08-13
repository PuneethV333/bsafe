import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

/** Structural match for @nestjs/throttler's ThrottlerStorageRecord (not re-exported at root). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * `@nestjs/throttler` (v6) storage backed by the shared RedisService.
 *
 * Keys:
 *   throttler:<name>:<tracker>        — INCR counter with EX matching the window ttl
 *   throttler:<name>:<tracker>:block  — PX timestamp of the block expiry
 *
 * When a block flag is present every further increment reports `isBlocked` so the
 * guard answers 429 without needing another counter read.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redis.redis;
    const countKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${countKey}:block`;

    const blockedUntilRaw = await client.get(blockKey);
    if (blockedUntilRaw) {
      const timeToBlockExpire = Number(blockedUntilRaw) - Date.now();
      return {
        totalHits: Number.MAX_SAFE_INTEGER,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.max(timeToBlockExpire, 0),
      };
    }

    const totalHits = await client.incr(countKey);
    let timeToExpire = ttl;
    if (totalHits === 1) {
      await client.expire(countKey, Math.ceil(ttl / 1000));
    } else {
      const ttlMs = await client.pttl(countKey);
      if (ttlMs > 0) timeToExpire = ttlMs;
    }

    const isBlocked = totalHits >= limit;
    let timeToBlockExpire = 0;
    if (isBlocked) {
      timeToBlockExpire = blockDuration;
      await client.set(blockKey, String(Date.now() + blockDuration), 'PX', blockDuration);
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }
}