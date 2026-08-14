import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { NotificationDeliveryDto } from '@bsafe/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';

/**
 * Delivery-status visibility + manual retry. The retry route is scoped to the
 * alert owner for now; it becomes admin-only in Phase 8 (Admin dashboard).
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  @Get(':alertId/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async status(
    @CurrentUser('uid') uid: string,
    @Param('alertId', new ParseUUIDPipe()) alertId: string,
  ): Promise<NotificationDeliveryDto[]> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.notifications.getStatus(userId, alertId);
  }

  @Post(':alertId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async retry(
    @CurrentUser('uid') uid: string,
    @Param('alertId', new ParseUUIDPipe()) alertId: string,
  ): Promise<{ requeued: number }> {
    const userId = await this.users.resolveLocalUserId(uid);
    const requeued = await this.notifications.retryFailed(userId, alertId);
    return { requeued };
  }
}