import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';

@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller()
export class AppController {
  @Get()
  hello(): { service: string; message: string } {
    return { service: 'bsafe-api', message: 'Hello from the bSafe API' };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
    };
  }
}
