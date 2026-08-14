import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AlertLocationDto,
  AlertTrackingDto,
} from '@bsafe/shared-types';
import { PrismaService } from '../prisma/prisma.service';

type TrackingAlert = {
  id: string;
  status: string;
  triggeredAt: Date;
  resolvedAt: Date | null;
  user: { name: string };
  lastLocation: {
    id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: Date;
  } | null;
  _count: { locations: number };
};

/**
 * Public, tokenized tracking access. The tracking token is unguessable
 * (UUID) and the payload is view-only — no alert IDs, contact data, or
 * phone numbers are exposed. A resolved alert returns its final state and
 * stops being updated (the live map "expires" once resolved).
 */
@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async getByToken(token: string): Promise<AlertTrackingDto> {
    const alert = await this.prisma.alert.findUnique({
      where: { trackingToken: token },
      include: {
        user: { select: { name: true } },
        lastLocation: true,
        _count: { select: { locations: true } },
      },
    });
    if (!alert) {
      throw new NotFoundException('This tracking link is invalid or expired.');
    }
    return toTrackingDto(alert);
  }

  /** A contact acknowledges the alert (only possible while `sent`). */
  async acknowledge(token: string): Promise<AlertTrackingDto> {
    const alert = await this.prisma.alert.findUnique({
      where: { trackingToken: token },
    });
    if (!alert) {
      throw new NotFoundException('This tracking link is invalid or expired.');
    }
    if (alert.status === 'resolved') {
      throw new BadRequestException('This alert is already resolved.');
    }
    if (alert.status === 'acknowledged') {
      throw new BadRequestException('This alert is already acknowledged.');
    }

    await this.prisma.alert.update({
      where: { id: alert.id },
      data: { status: 'acknowledged' },
    });
    await this.prisma.activityLog.create({
      data: { alertId: alert.id, eventType: 'acknowledged', actor: 'contact' },
    });
    return this.getByToken(token);
  }
}

function toTrackingDto(alert: TrackingAlert): AlertTrackingDto {
  return {
    id: alert.id,
    status: alert.status as AlertTrackingDto['status'],
    userName: alert.user.name,
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