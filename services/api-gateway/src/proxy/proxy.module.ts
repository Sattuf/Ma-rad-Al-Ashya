import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyController } from './proxy.controller';
import { ResponseCacheService } from '../cache/response-cache.service';

/**
 * وحدة التوجيه الوكيل — Proxy Module
 * تسجل HttpModule وتوفر ProxyController لتوجيه الطلبات
 */
@Module({
  imports: [HttpModule],
  controllers: [ProxyController],
  providers: [ResponseCacheService],
})
export class ProxyModule {}
