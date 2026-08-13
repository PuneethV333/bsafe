import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  hello(): { service: string; message: string } {
    return { service: 'bsafe-api', message: 'Hello from the bSafe API' };
  }
}
