import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'identity-service',
      timestamp: new Date().toISOString(),
    };
  }
}
