import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Gauge, register } from 'prom-client';
import { Repository } from 'typeorm';
import { TtlCache } from '../common/stats';
import { Report } from './entities/report.entity';

/** Open = not yet decided ("reviewed" means looked at, still open). */
const OPEN_STATUSES = ['pending', 'reviewed'];

export interface QueueSnapshot {
  open: number;
  oldestAgeSeconds: number;
}

/**
 * The moderation queue as Prometheus gauges, read on each scrape (cached 30s so several
 * scrapers cannot load the database). Both queries use idx_reports_status_created.
 * Alerted on by ReportsWaitingTooLong (infra/monitoring/alerts.yml).
 */
@Injectable()
export class QueueMetrics implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetrics.name);
  private readonly cache = new TtlCache<QueueSnapshot>(30_000);
  private gauges: Gauge[] = [];

  constructor(@InjectRepository(Report) private readonly reports: Repository<Report>) {}

  async snapshot(): Promise<QueueSnapshot> {
    return this.cache.get(async () => {
      const row = await this.reports
        .createQueryBuilder('r')
        .select('count(*)', 'open')
        .addSelect('min(r.created_at)', 'oldest')
        .where('r.status IN (:...statuses)', { statuses: OPEN_STATUSES })
        .getRawOne<{ open: string; oldest: Date | string | null }>();
      const oldest = row?.oldest ? new Date(row.oldest).getTime() : undefined;
      return {
        open: Number(row?.open ?? 0),
        oldestAgeSeconds: oldest ? Math.max(0, Math.round((Date.now() - oldest) / 1000)) : 0,
      };
    });
  }

  onModuleInit() {
    const metrics = this;
    const read = async (pick: (s: QueueSnapshot) => number, gauge: Gauge) => {
      try {
        gauge.set(pick(await metrics.snapshot()));
      } catch (err) {
        // A failed read must not look like an empty queue (0): NaN reads as "unknown".
        gauge.set(NaN);
        metrics.logger.warn(`Queue metrics unavailable: ${(err as Error).message}`);
      }
    };
    this.gauges = [
      new Gauge({
        name: 'moderation_open_reports',
        help: 'Reports waiting for a moderator decision (pending or reviewed)',
        async collect() {
          await read((s) => s.open, this);
        },
      }),
      new Gauge({
        name: 'moderation_oldest_open_report_age_seconds',
        help: 'Age of the oldest report still waiting for a decision (0 when the queue is empty)',
        async collect() {
          await read((s) => s.oldestAgeSeconds, this);
        },
      }),
    ];
  }

  onModuleDestroy() {
    for (const g of this.gauges) register.removeSingleMetric((g as any).name);
  }
}
