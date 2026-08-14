import { Global, Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsGateway } from './alerts.gateway';
import { AlertsService } from './alerts.service';

@Global()
@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertsGateway],
  exports: [AlertsService],
})
export class AlertsModule {}