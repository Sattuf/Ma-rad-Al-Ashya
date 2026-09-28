import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Liveness probe used by the gateway's upstream_up metric and container health checks. */
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'users-service', timestamp: new Date().toISOString() };
  }
}
