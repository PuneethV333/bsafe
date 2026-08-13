import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE, notificationQueueProvider } from './notification-queue';

@Injectable()
class NotificationQueueLifecycle implements OnModuleDestroy {
  constructor(@Inject(NOTIFICATION_QUEUE) private readonly queue: Queue) {}

  async onModuleDestroy(): Promise<void> {
    // Queue.close() is idempotent — safe whether or not the queue is already closed.
    await this.queue.close();
  }
}

/**
 * Notification dispatch queue provisioned now (Phase 3 infra); jobs are enqueued
 * and processed from Phase 6 (Twilio/SendGrid workers).
 */
@Global()
@Module({
  providers: [notificationQueueProvider, NotificationQueueLifecycle],
  exports: [NOTIFICATION_QUEUE],
})
export class NotificationsModule {}