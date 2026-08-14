import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { NotificationDeliveryDto } from '@bsafe/shared-types';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';

/**
 * Delivery-status visibility (owner) + manual retry (admin).
 * Retry is admin-gated per the route table — owners read status, admins
 * re-drive failed deliveries from the dashboard.
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
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async retry(
    @Param('alertId', new ParseUUIDPipe()) alertId: string,
  ): Promise<{ requeued: number }> {
    const requeued = await this.notifications.retryFailedAdmin(alertId);
    return { requeued };
  }
}