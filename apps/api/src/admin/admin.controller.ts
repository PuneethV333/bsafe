import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AdminAlertRowDto, AdminReportDto } from '@bsafe/shared-types';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminAlertsQueryDto } from './dto/admin-alerts-query.dto';

/**
 * Read-only admin dashboard. Every route carries its own @Throttle override
 * (route table §3) and requires an admin account (AdminGuard).
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('alerts')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async alerts(@Query() query: AdminAlertsQueryDto): Promise<AdminAlertRowDto[]> {
    return this.admin.listAlerts({
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      userId: query.userId,
      take: query.take ?? 50,
      skip: query.skip ?? 0,
    });
  }

  @Get('reports')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reports(): Promise<AdminReportDto> {
    return this.admin.getReports();
  }
}