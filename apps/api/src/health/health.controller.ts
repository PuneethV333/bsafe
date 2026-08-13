import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  @Get()
  async check(): Promise<{ status: string; redis: string; time: string }> {
    return {
      status: 'ok',
      redis: await this.redis.ping(),
      time: new Date().toISOString(),
    };
  }
}
