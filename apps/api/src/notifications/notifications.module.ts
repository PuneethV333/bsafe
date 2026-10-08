import { Global, Module } from '@nestjs/common';
import {
  NOTIFICATION_QUEUE,
  notificationQueueProvider,
} from './notification-queue';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './notifications.processor';
import { smsProviderFactory } from './providers/twilio.provider';

/**
 * Notification dispatch (Phase 6): BullMQ queue + worker dispatch jobs to
 * Twilio over SMS. SMS is dry-run by default (NOTIFICATIONS_DRY_RUN).
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    notificationQueueProvider,
    smsProviderFactory,
    NotificationsService,
    NotificationsWorker,
  ],
  exports: [NotificationsService, NOTIFICATION_QUEUE],
})
export class NotificationsModule {}