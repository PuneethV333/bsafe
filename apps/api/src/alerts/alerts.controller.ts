import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AlertDto, AlertListItemDto } from '@bsafe/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AlertsService } from './alerts.service';
import { TriggerAlertDto, UpdateLocationDto, UpdateStatusDto } from './dto';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly users: UsersService,
  ) {}

  /**
   * Fire a silent SOS. Deliberately low limit (5/min per user) — high enough
   * for a genuine re-trigger, low enough to blunt abuse. Trade-off noted in
   * PHASE_LOG; revisit after Phase 9 load testing.
   */
  @Post('trigger')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async trigger(
    @CurrentUser('uid') uid: string,
    @Body() dto: TriggerAlertDto,
  ): Promise<AlertDto> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.alerts.create(userId, dto);
  }

  /** REST fallback for location pings when the WebSocket drops. */
  @Post(':id/location')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async addLocation(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.alerts.addLocation(userId, id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateStatus(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<AlertDto> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.alerts.updateStatus(userId, id, dto.status);
  }

  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async get(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AlertDto> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.alerts.getAlert(userId, id);
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async list(@CurrentUser('uid') uid: string): Promise<AlertListItemDto[]> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.alerts.listAlerts(userId);
  }
}
