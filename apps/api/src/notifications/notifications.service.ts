import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { NotificationDeliveryDto } from '@bsafe/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_QUEUE,
  type NotificationJob,
} from './notification-queue';

type AlertRef = {
  id: string;
  trackingToken: string;
  triggeredAt: Date;
};

/**
 * Notification dispatch orchestration. Enqueues one BullMQ job per contact per
 * channel (never sends synchronously from the request thread) and tracks
 * per-delivery status in Postgres.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJob>,
  ) {}

  /**
   * Create queued delivery rows for every reachable channel of the alert
   * owner's contacts and enqueue a notify job for each. Contactless alerts
   * enqueue nothing.
   */
  async enqueueForAlert(
    alert: AlertRef,
    userId: string,
  ): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const contacts = await this.prisma.emergencyContact.findMany({
      where: { userId },
    });
    const trackingUrl = `${this.trackingBase()}/track/${alert.trackingToken}`;

    const tasks = contacts.flatMap<Promise<void>>((contact) => {
      const perContact: Promise<void>[] = [];
      const { phone } = contact;
      if (phone) {
        perContact.push(
          (async () => {
            const delivery = await this.prisma.notificationDelivery.create({
              data: { alertId: alert.id, contactId: contact.id, channel: 'sms' },
            });
            await this.enqueue({
              alertId: alert.id,
              contactId: contact.id,
              deliveryId: delivery.id,
              channel: 'sms',
              trackingUrl,
              userName: user.name,
              triggeredAt: alert.triggeredAt.toISOString(),
              contactPhone: phone,
            });
          })(),
        );
      }
      return perContact;
    });

    await Promise.all(tasks);
    return tasks.length;
  }

  /** Re-queue every failed delivery for an alert (admin-gated) and enqueue fresh jobs. */
  async retryFailedAdmin(alertId: string): Promise<number> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { user: { select: { name: true } } },
    });
    if (!alert) throw new NotFoundException('Alert not found.');

    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { alertId, status: 'failed' },
      include: { contact: true },
    });

    let enqueued = 0;
    for (const delivery of deliveries) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'queued', attempts: 0, lastError: null },
      });
      await this.enqueue({
        alertId: alert.id,
        contactId: delivery.contactId,
        deliveryId: delivery.id,
        channel: delivery.channel,
        trackingUrl: `${this.trackingBase()}/track/${alert.trackingToken}`,
        userName: alert.user.name,
        triggeredAt: alert.triggeredAt.toISOString(),
        contactPhone: delivery.contact.phone ?? undefined,
      });
      enqueued++;
    }
    return enqueued;
  }

  /** Per-contact, per-channel delivery status for an alert (owner-scoped). */
  async getStatus(
    userId: string,
    alertId: string,
  ): Promise<NotificationDeliveryDto[]> {
    await this.findOwnedAlert(userId, alertId);
    const rows = await this.prisma.notificationDelivery.findMany({
      where: { alertId },
      include: { contact: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toDeliveryDto(row));
  }

  /** Mark one delivery attempt as started (increments attempts). */
  async beginAttempt(deliveryId: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { attempts: { increment: 1 }, status: 'queued' },
    });
  }

  /** Mark a delivery as handed to the provider. */
  async markSent(deliveryId: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'sent', sentAt: new Date(), lastError: null },
    });
  }

  /** Mark a delivery as permanently failed after retries are exhausted. */
  async markFailed(deliveryId: string, error: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'failed', lastError: error },
    });
  }

  private async enqueue(job: NotificationJob): Promise<void> {
    await this.queue.add('notify', job);
  }

  private async findOwnedAlert(userId: string, alertId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });
    if (!alert || alert.userId !== userId) {
      throw new NotFoundException('Alert not found.');
    }
    return alert;
  }

  private trackingBase(): string {
    return this.config.get<string>('WEB_BASE_URL', 'http://localhost:5173');
  }
}

function toDeliveryDto(row: {
  id: string;
  contactId: string;
  channel: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
  contact: { name: string };
}): NotificationDeliveryDto {
  return {
    id: row.id,
    contactId: row.contactId,
    contactName: row.contact.name,
    channel: row.channel as NotificationDeliveryDto['channel'],
    status: row.status as NotificationDeliveryDto['status'],
    attempts: row.attempts,
    lastError: row.lastError,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}