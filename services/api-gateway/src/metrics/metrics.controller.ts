import { CanActivate, Controller, ExecutionContext, Get, Injectable, NotFoundException, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

const digest = (v: string) => createHash('sha256').update(v).digest();

/**
 * The gateway listens on the public port, so /metrics must not be world-readable (it
 * reveals traffic, error rates and service names). Prometheus sends
 * `Authorization: Bearer $METRICS_TOKEN` (see infra/monitoring/prometheus.yml).
 * Without a token configured the endpoint is open in development and absent in production.
 */
@Injectable()
export class MetricsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.METRICS_TOKEN;
    if (!expected) {
      if (process.env.NODE_ENV === 'production') throw new NotFoundException();
      return true;
    }
    const header = context.switchToHttp().getRequest().headers?.authorization ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    // Hash both sides so the comparison is constant-time regardless of length.
    if (!provided || !timingSafeEqual(digest(provided), digest(expected))) throw new NotFoundException();
    return true;
  }
}

@ApiExcludeController()
@Controller()
export class MetricsController extends PrometheusController {
  @Get()
  @UseGuards(MetricsTokenGuard)
  index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
