import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import type { TriggerType } from '@bsafe/shared-types';

export class TriggerAlertDto {
  @IsOptional()
  @IsIn(['tap', 'longPress'])
  triggerType?: TriggerType;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
