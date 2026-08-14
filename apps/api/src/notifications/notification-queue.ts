import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { redisConnection } from '../redis/redis-config';

/** DI token for the BullMQ `notifications` queue (consumed from Phase 6). */
export const NOTIFICATION_QUEUE = 'NOTIFICATION_QUEUE';

export type NotificationChannel = 'sms' | 'email';

export interface NotificationJob {
  alertId: string;
  contactId: string;
  deliveryId: string;
  channel: NotificationChannel;
  trackingUrl: string;
  userName: string;
  triggeredAt: string;
  contactPhone?: string;
  contactEmail?: string;
}

export const notificationQueueProvider: FactoryProvider<Queue<NotificationJob>> = {
  provide: NOTIFICATION_QUEUE,
  useFactory: (config: ConfigService) =>
    new Queue<NotificationJob>('notifications', {
      connection: redisConnection(config),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86_400, count: 1000 },
      },
    }),
  inject: [ConfigService],
};