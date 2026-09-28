import { Injectable, ConflictException, BadRequestException, NotFoundException, BadGatewayException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportCount } from './entities/report-count.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { internalHeaders } from '../common/security';
import { TtlCache, dailySeries, windowStart } from '../common/stats';

const REVIEW_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'];
const REVIEW_ACTIONS = ['none', 'warning', 'listing_removed', 'user_suspended', 'user_banned'];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly statsCache = new TtlCache<Awaited<ReturnType<ReportsService['computeAdminStats']>>>(30_000);

  constructor(
    @InjectRepository(Report)
    private reportsRepository: Repository<Report>,
    @InjectRepository(ReportCount)
    private reportCountsRepository: Repository<ReportCount>,
    @InjectQueue('auto-review') private autoReviewQueue: Queue,
    private httpService: HttpService,
  ) {}

  async createReport(reporterId: string, createDto: CreateReportDto) {
    if (reporterId === createDto.target_id) {
      throw new BadRequestException('Cannot report yourself or your own listing');
    }

    const existing = await this.reportsRepository.findOne({
      where: {
        reporter_id: reporterId,
        target_type: createDto.target_type,
        target_id: createDto.target_id,
      }
    });

    if (existing) {
      throw new ConflictException('You have already reported this item');
    }

    const report = this.reportsRepository.create({
      reporter_id: reporterId,
      target_type: createDto.target_type,
      target_id: createDto.target_id,
      reason: createDto.reason,
      description: createDto.description,
    });
    
    await this.reportsRepository.save(report);

    // Update counts
    let count = await this.reportCountsRepository.findOne({
      where: {
        target_type: createDto.target_type,
        target_id: createDto.target_id,
      }
    });

    if (!count) {
      count = this.reportCountsRepository.create({
        target_type: createDto.target_type,
        target_id: createDto.target_id,
        pending_count: 1,
        total_count: 1,
      });
    } else {
      count.pending_count += 1;
      count.total_count += 1;
      count.last_reported_at = new Date();
    }
    
    await this.reportCountsRepository.save(count);

    // Enqueue if thresholds met
    if (createDto.target_type === 'listing' && count.pending_count >= 3) {
      await this.autoReviewQueue.add('auto_review_listing', { target_id: createDto.target_id });
    } else if (createDto.target_type === 'user' && count.pending_count >= 5) {
      await this.autoReviewQueue.add('auto_review_user', { target_id: createDto.target_id });
    }

    return report;
  }

  async getMyReports(reporterId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.reportsRepository.findAndCount({
      where: { reporter_id: reporterId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  // Admin methods
  async getAdminReports(query: any) {
    const { status, target_type, page = 1, limit = 20 } = query;
    const qb = this.reportsRepository.createQueryBuilder('report');

    if (status) qb.andWhere('report.status = :status', { status });
    if (target_type) qb.andWhere('report.target_type = :target_type', { target_type });

    // Join with report_counts to sort by pending_count
    qb.leftJoinAndMapOne('report.counts', ReportCount, 'counts', 'report.target_type = counts.target_type AND report.target_id = counts.target_id');
    qb.orderBy('counts.pending_count', 'DESC');
    qb.addOrderBy('report.created_at', 'DESC');
    
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getReportDetail(id: string) {
    const report = await this.reportsRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    const relatedReports = await this.reportsRepository.find({
      where: { target_type: report.target_type, target_id: report.target_id },
      order: { created_at: 'DESC' }
    });

    return { report, relatedReports };
  }

  async reviewReport(id: string, reviewDto: any, adminId: string) {
    const status = reviewDto?.status;
    const action = reviewDto?.action_taken ?? 'none';
    if (!REVIEW_STATUSES.includes(status)) throw new BadRequestException('Invalid status');
    if (!REVIEW_ACTIONS.includes(action)) throw new BadRequestException('Invalid action');

    const report = await this.reportsRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    // Apply the enforcement first: a review recorded as "listing removed" while the
    // listing is still online would mislead the moderator and the reporter.
    await this.applyAction(report, action);

    // "reviewed" is still open (looked at, not decided); the queue count covers open reports.
    const wasOpen = report.status === 'pending' || report.status === 'reviewed';
    report.status = status;
    report.action_taken = action;
    report.admin_note = typeof reviewDto.admin_note === 'string' ? reviewDto.admin_note.slice(0, 2000) : report.admin_note;
    report.reviewed_by = adminId;
    report.reviewed_at = new Date();
    const saved = await this.reportsRepository.save(report);

    // Only an open → closed transition leaves the queue (re-reviews must not drift the count).
    if (wasOpen && (status === 'resolved' || status === 'dismissed')) {
      const count = await this.reportCountsRepository.findOne({
        where: { target_type: report.target_type, target_id: report.target_id },
      });
      if (count && count.pending_count > 0) {
        count.pending_count -= 1;
        await this.reportCountsRepository.save(count);
      }
    }
    return saved;
  }

  private async applyAction(report: Report, action: string) {
    let request: { url: string; body: { status: string }; what: string } | null = null;
    if (action === 'listing_removed' && report.target_type === 'listing') {
      const listingsUrl = process.env.LISTINGS_SERVICE_URL || 'http://listings-service:3002';
      request = { url: `${listingsUrl}/listings/${report.target_id}/status`, body: { status: 'deleted' }, what: 'إزالة الإعلان' };
    } else if ((action === 'user_suspended' || action === 'user_banned') && report.target_type === 'user') {
      const usersUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3007';
      request = {
        url: `${usersUrl}/users/${report.target_id}/status`,
        body: { status: action === 'user_suspended' ? 'suspended' : 'banned' },
        what: action === 'user_suspended' ? 'إيقاف الحساب' : 'حظر الحساب',
      };
    } else if (action !== 'none' && action !== 'warning') {
      throw new BadRequestException('هذا الإجراء لا يناسب نوع البلاغ');
    }
    if (!request) return;
    try {
      await firstValueFrom(this.httpService.put(request.url, request.body, { headers: internalHeaders(), timeout: 5000 }));
    } catch (e) {
      this.logger.error(`Moderation action failed for report ${report.id}: ${e.message}`);
      throw new BadGatewayException(`تعذّر ${request.what} الآن، ولم تُحفظ المراجعة. حاول مجدداً.`);
    }
  }

  /**
   * Admin dashboard numbers. Bounded queries (30-day window, LIMIT on rankings), cached
   * 30s: short enough that the queue count follows the moderators' work closely.
   */
  getAdminStats() {
    return this.statsCache.get(() => this.computeAdminStats());
  }

  private async computeAdminStats() {
    // reports.created_at / reviewed_at are TIMESTAMP (no zone) written in UTC.
    const since = windowStart().toISOString().slice(0, 19).replace('T', ' ');
    const today = new Date().toISOString().slice(0, 10);
    const q = (sql: string, params: unknown[] = []) => this.reportsRepository.query(sql, params);

    const [totals, created, handled, reasons, topListings, topUsers] = await Promise.all([
      q(
        `SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
                count(*)::int AS total,
                count(*) FILTER (WHERE created_at >= $1::date)::int AS today,
                count(*) FILTER (WHERE reviewed_at >= $1::date AND status IN ('resolved', 'dismissed'))::int AS handled_today,
                extract(epoch FROM (now() AT TIME ZONE 'UTC') - min(created_at) FILTER (WHERE status = 'pending'))::float / 3600 AS oldest_pending_hours,
                avg(extract(epoch FROM reviewed_at - created_at)) FILTER (WHERE reviewed_at >= $2)::float / 3600 AS avg_review_hours
           FROM reports`,
        [today, since],
      ),
      q(`SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count FROM reports WHERE created_at >= $1 GROUP BY 1`, [since]),
      q(
        `SELECT to_char(reviewed_at, 'YYYY-MM-DD') AS day, count(*)::int AS count FROM reports
          WHERE reviewed_at >= $1 AND status IN ('resolved', 'dismissed') GROUP BY 1`,
        [since],
      ),
      q(`SELECT reason, count(*)::int AS count FROM reports WHERE created_at >= $1 GROUP BY reason ORDER BY 2 DESC`, [since]),
      this.reportCountsRepository.find({ where: { target_type: 'listing', pending_count: MoreThan(0) }, order: { pending_count: 'DESC' }, take: 5 }),
      this.reportCountsRepository.find({ where: { target_type: 'user', pending_count: MoreThan(0) }, order: { pending_count: 'DESC' }, take: 5 }),
    ]);

    const t = totals[0] ?? {};
    const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
    return {
      pending_reports: t.pending ?? 0,
      total_reports: t.total ?? 0,
      reports_today: t.today ?? 0,
      resolved_today: t.handled_today ?? 0,
      oldest_pending_hours: round1(t.oldest_pending_hours),
      avg_review_hours_30d: round1(t.avg_review_hours),
      created_daily: dailySeries(created),
      handled_daily: dailySeries(handled),
      reasons_30d: reasons,
      top_reported_listings: topListings,
      top_reported_users: topUsers,
    };
  }
}
