import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyController } from './proxy.controller';

/**
 * وحدة التوجيه الوكيل — Proxy Module
 * تسجل HttpModule وتوفر ProxyController لتوجيه الطلبات
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
  ],
  controllers: [ProxyController],
})
export class ProxyModule {}
