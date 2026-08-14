import { Injectable } from '@nestjs/common';
import type {
  AdminAlertRowDto,
  AdminReportDto,
  AlertStatus,
} from '@bsafe/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminAlertsFilter } from './dto/admin-alerts-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cross-user alert table with filters + offset pagination. */
  async listAlerts(filter: AdminAlertsFilter): Promise<AdminAlertRowDto[]> {
    const rows = await this.prisma.alert.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.from || filter.to
          ? {
              triggeredAt: {
                ...(filter.from ? { gte: filter.from } : {}),
                ...(filter.to ? { lte: filter.to } : {}),
              },
            }
          : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { locations: true } },
        activityLogs: {
          where: { eventType: 'acknowledged' },
          select: { timestamp: true },
          orderBy: { timestamp: 'asc' },
          take: 1,
        },
        notificationDeliveries: { select: { status: true } },
      },
      orderBy: { triggeredAt: 'desc' },
      take: filter.take,
      skip: filter.skip,
    });

    return rows.map((row) => {
      const sent = row.notificationDeliveries.filter((d) => d.status === 'sent').length;
      const failed = row.notificationDeliveries.filter((d) => d.status === 'failed').length;
      return {
        id: row.id,
        status: row.status as AlertStatus,
        userName: row.user.name,
        userEmail: row.user.email,
        triggeredAt: row.triggeredAt.toISOString(),
        acknowledgedAt: row.activityLogs[0]?.timestamp.toISOString() ?? null,
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        locationCount: row._count.locations,
        deliveriesSent: sent,
        deliveriesFailed: failed,
      };
    });
  }

  /** Read-only aggregate KPIs for the admin dashboard. */
  async getReports(): Promise<AdminReportDto> {
    const [total, resolved, acknowledged, activeNow, perDay, ackAvg, resolveAvg] =
      await Promise.all([
        this.prisma.alert.count(),
        this.prisma.alert.count({ where: { status: 'resolved' } }),
        this.prisma.alert.count({
          where: { status: { in: ['acknowledged', 'resolved'] } },
        }),
        this.prisma.alert.count({
          where: {
            status: { in: ['sent', 'acknowledged'] },
            triggeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.$queryRaw<{ day: Date; count: number }[]>`
          SELECT date_trunc('day', triggered_at)::date AS day, COUNT(*)::int AS count
          FROM "Alert"
          WHERE triggered_at >= now() - interval '30 days'
          GROUP BY 1 ORDER BY 1
        `,
        this.prisma.$queryRaw<{ minutes: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM (l.timestamp - a.triggered_at)) / 60.0)::float8 AS minutes
          FROM "ActivityLog" l JOIN "Alert" a ON a.id = l.alert_id
          WHERE l.event_type = 'acknowledged'
        `,
        this.prisma.$queryRaw<{ minutes: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM (a.resolved_at - a.triggered_at)) / 60.0)::float8 AS minutes
          FROM "Alert" a WHERE a.resolved_at IS NOT NULL
        `,
      ]);

    return {
      totals: { alerts: total, acknowledged, resolved },
      activeNow,
      ackRate: total === 0 ? 0 : acknowledged / total,
      alertsPerDay: perDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: r.count })),
      avgAcknowledgeMinutes: ackAvg[0]?.minutes ?? null,
      avgResolveMinutes: resolveAvg[0]?.minutes ?? null,
    };
  }
}