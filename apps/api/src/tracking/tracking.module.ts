import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

/** Public tokenized tracking view for contacts (Phase 7). */
@Module({
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}