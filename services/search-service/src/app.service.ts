import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'search-service',
      timestamp: new Date().toISOString(),
    };
  }
}
