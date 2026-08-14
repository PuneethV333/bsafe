import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { AlertStatus } from '@bsafe/shared-types';

export class AdminAlertsQueryDto {
  @IsOptional()
  @IsIn(['sent', 'acknowledged', 'resolved'])
  status?: AlertStatus;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(200)
  take?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(0)
  skip?: number;
}

export interface AdminAlertsFilter {
  status?: AlertStatus;
  from?: Date;
  to?: Date;
  userId?: string;
  take: number;
  skip: number;
}