import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Admin/monitoring dashboard (Phase 8, optional scope). */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}