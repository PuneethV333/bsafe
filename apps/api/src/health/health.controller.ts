import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  /** Uptime check for external pinger/monitoring — public, 60/min per IP. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  async check(): Promise<{ status: string; redis: string; time: string }> {
    return {
      status: 'ok',
      redis: await this.redis.ping(),
      time: new Date().toISOString(),
    };
  }
}