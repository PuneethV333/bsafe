import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { type NotificationJob } from './notification-queue';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  type EmailProvider,
  type SmsProvider,
} from './providers/provider.tokens';

/**
 * BullMQ worker that dispatches queued notification jobs to Twilio/SendGrid.
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
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {
    this.worker = new Worker<NotificationJob>(
      'notifications',
      (job) => this.process(job),
      {
        connection: {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
        },
        concurrency: 5,
      },
    );
    this.worker.on('error', (err) =>
      this.logger.error(`BullMQ worker error: ${err.message}`),
    );
    this.logger.log(
      `notifications worker started (${this.sms.name} / ${this.email.name})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }

  private async process(job: Job<NotificationJob>): Promise<void> {
    const { deliveryId, channel } = job.data;
    await this.notifications.beginAttempt(deliveryId);

    try {
      if (channel === 'sms') {
        if (!job.data.contactPhone) {
          throw new Error('SMS delivery is missing a contact phone.');
        }
        await this.sms.sendSms(job.data.contactPhone, smsBody(job.data));
      } else {
        if (!job.data.contactEmail) {
          throw new Error('Email delivery is missing a contact email.');
        }
        await this.email.sendEmail(
          job.data.contactEmail,
          emailSubject(job.data),
          emailHtml(job.data),
        );
      }
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

export function emailSubject(job: NotificationJob): string {
  return `bsafe SOS from ${job.userName}`;
}

export function emailHtml(job: NotificationJob): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
  <h2>bsafe SOS alert</h2>
  <p><strong>${escapeHtml(job.userName)}</strong> triggered an emergency alert at
  ${formatTime(job.triggeredAt)}.</p>
  <p>Track the live location and acknowledge the alert here:</p>
  <p><a href="${job.trackingUrl}"
    style="display:inline-block;background:#dc2626;color:#fff;padding:12px 20px;
           border-radius:8px;text-decoration:none">Open live tracking</a></p>
  <p style="color:#6b7280;font-size:12px">This link is view-only and expires when
  the alert is resolved.</p>
</div>`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}