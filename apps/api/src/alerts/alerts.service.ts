import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AlertDto,
  AlertListItemDto,
  AlertLocationDto,
} from '@bsafe/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { withReadRetry } from '../prisma/retry';
import { NotificationsService } from '../notifications/notifications.service';
import { TriggerAlertDto, UpdateLocationDto } from './dto';

type AlertWithLocation = {
  id: string;
  status: string;
  triggeredAt: Date;
  resolvedAt: Date | null;
  lastLocation: {
    id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: Date;
  } | null;
  _count: { locations: number };
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Fire a silent SOS. Creates the alert in `sent` state, records the first
   * location when the client grabbed an initial fix, then enqueues one
   * notification job per reachable contact channel (queued in Postgres first,
   * dispatched async by the BullMQ worker — never synchronously).
   */
  async create(userId: string, dto: TriggerAlertDto): Promise<AlertDto> {
    const alert = await this.prisma.alert.create({ data: { userId } });
    await this.log(alert.id, 'triggered', `user:${userId}`);

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.addLocation(userId, alert.id, {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
      });
    }
    void this.notifications.enqueueForAlert(alert, userId).catch((err) => {
      this.logger.error(`notification enqueue for alert ${alert.id} failed`, err.stack);
    });
    return this.getAlert(userId, alert.id);
  }

  /** Persist a location ping and promote it to the alert's `lastLocation`. */
  async addLocation(
    userId: string,
    alertId: string,
    dto: UpdateLocationDto,
  ): Promise<AlertLocationDto> {
    const alert = await this.findOwned(userId, alertId);
    if (alert.status === 'resolved') {
      throw new ConflictException('Alert is already resolved — location streaming stopped.');
    }

    const location = await this.prisma.alertLocation.create({
      data: {
        alertId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
      },
    });
    await this.prisma.alert.update({
      where: { id: alertId },
      data: { lastLocationId: location.id },
    });
    return toLocationDto(location);
  }

  /** Transition alert status (sent → acknowledged → resolved). */
  async updateStatus(
    userId: string,
    alertId: string,
    status: 'acknowledged' | 'resolved',
  ): Promise<AlertDto> {
    const alert = await this.findOwned(userId, alertId);
    if (alert.status === 'resolved') {
      throw new BadRequestException('Alert is already resolved.');
    }
    if (status === 'acknowledged' && alert.status !== 'sent') {
      throw new BadRequestException('Only a sent alert can be acknowledged.');
    }

    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status,
        ...(status === 'resolved' ? { resolvedAt: new Date() } : {}),
      },
    });
    await this.log(alertId, status, `user:${userId}`);
    return this.getAlert(userId, updated.id);
  }

  /** Single alert with its last known location. Ownership-scoped. */
  async getAlert(userId: string, id: string): Promise<AlertDto> {
    await this.findOwned(userId, id);
    // Read-only, so a dropped pooled connection can be replayed safely — this
    // is the last step of an SOS trigger and must not 500 on a blip.
    const alert = await withReadRetry(() =>
      this.prisma.alert.findUniqueOrThrow({
        where: { id },
        include: { lastLocation: true, _count: { select: { locations: true } } },
      }),
    );
    return toAlertDto(alert);
  }

  /** Current user's alert history, newest first. */
  async listAlerts(userId: string): Promise<AlertListItemDto[]> {
    const alerts = await this.prisma.alert.findMany({
      where: { userId },
      orderBy: { triggeredAt: 'desc' },
      include: { lastLocation: true, _count: { select: { locations: true } } },
    });
    return alerts.map(toAlertDto);
  }

  /** Ownership-scoped lookup used by the gateway; throws when not owned/missing. */
  async findOwned(userId: string, alertId: string) {
    const alert = await withReadRetry(() =>
      this.prisma.alert.findUnique({ where: { id: alertId } }),
    );
    if (!alert || alert.userId !== userId) {
      throw new NotFoundException('Alert not found.');
    }
    return alert;
  }

  private async log(alertId: string, eventType: string, actor: string): Promise<void> {
    await this.prisma.activityLog.create({ data: { alertId, eventType, actor } });
  }
}

function toAlertDto(alert: AlertWithLocation): AlertDto {
  return {
    id: alert.id,
    status: alert.status as AlertDto['status'],
    triggeredAt: alert.triggeredAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    lastLocation: alert.lastLocation ? toLocationDto(alert.lastLocation) : null,
    locationCount: alert._count.locations,
  };
}

function toLocationDto(location: {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: Date;
}): AlertLocationDto {
  return {
    id: location.id,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    recordedAt: location.recordedAt.toISOString(),
  };
}