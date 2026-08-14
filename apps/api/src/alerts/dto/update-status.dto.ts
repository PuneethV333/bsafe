import { IsIn } from 'class-validator';
import type { AlertStatusUpdate } from '@bsafe/shared-types';

export class UpdateStatusDto {
  @IsIn(['acknowledged', 'resolved'])
  status!: AlertStatusUpdate;
}
