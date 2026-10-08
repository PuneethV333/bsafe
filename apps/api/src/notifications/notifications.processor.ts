import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { type NotificationJob } from './notification-queue';
import { redisConnection } from '../redis/redis-config';
import { SMS_PROVIDER, type SmsProvider } from './providers/provider.tokens';

/**
 * BullMQ worker that dispatches queued notification jobs to Twilio over SMS.
 * Delivery rows start `queued`, move to `sent` once handed to the provider, or
 * `failed` after BullMQ exhausts its exponential-backoff retries. Note that
 * "sent" means accepted by the provider — not delivered (per PRD §7).
 */
@Injectable()
export class NotificationsWorker implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorker.name);
  private readonly worker: Worker<NotificationJob>;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {
    this.worker = new Worker<NotificationJob>(
      'notifications',
      (job) => this.process(job),
      {
        connection: redisConnection(this.config),
        concurrency: 5,
      },
    );
    this.worker.on('error', (err) =>
      this.logger.error(`BullMQ worker error: ${err.message}`),
    );
    this.logger.log(`notifications worker started (${this.sms.name})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }

  private async process(job: Job<NotificationJob>): Promise<void> {
    const { deliveryId, channel } = job.data;
    await this.notifications.beginAttempt(deliveryId);

    try {
      if (!job.data.contactPhone) {
        throw new Error('SMS delivery is missing a contact phone.');
      }
      await this.sms.sendSms(job.data.contactPhone, smsBody(job.data));
      await this.notifications.markSent(deliveryId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const maxAttempts = job.opts.attempts ?? 3;
      if (job.attemptsMade + 1 >= maxAttempts) {
        await this.notifications.markFailed(deliveryId, message);
      }
      this.logger.warn(
        `delivery ${deliveryId} (${channel}) attempt ${job.attemptsMade + 1}/${maxAttempts} failed: ${message}`,
      );
      throw err;
    }
  }
}

export function smsBody(job: NotificationJob): string {
  return (
    `bsafe SOS from ${job.userName} at ${formatTime(job.triggeredAt)}. ` +
    `Track live location: ${job.trackingUrl}`
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}