import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AlertTrackingDto } from '@bsafe/shared-types';
import { Public } from '../common/decorators/public.decorator';
import { TrackingService } from './tracking.service';

/**
 * Public tokenized tracking endpoints (the links sent to contacts).
 * Unauthenticated, so limits are per-IP via the global throttler.
 */
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  async get(@Param('token') token: string): Promise<AlertTrackingDto> {
    return this.tracking.getByToken(token);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/acknowledge')
  async acknowledge(@Param('token') token: string): Promise<AlertTrackingDto> {
    return this.tracking.acknowledge(token);
  }
}