import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportCount } from './entities/report-count.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { internalHeaders } from '../common/security';

@Injectable()
export class ReportsService {
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
    const report = await this.reportsRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    report.status = reviewDto.status;
    report.action_taken = reviewDto.action_taken;
    report.admin_note = reviewDto.admin_note;
    report.reviewed_by = adminId;
    report.reviewed_at = new Date();

    const saved = await this.reportsRepository.save(report);

    // Decrement pending count if resolved/dismissed
    if (reviewDto.status === 'resolved' || reviewDto.status === 'dismissed') {
      const count = await this.reportCountsRepository.findOne({
        where: { target_type: report.target_type, target_id: report.target_id }
      });
      if (count && count.pending_count > 0) {
        count.pending_count -= 1;
        await this.reportCountsRepository.save(count);
      }
    }

    // Trigger HTTP actions
    if (reviewDto.action_taken === 'listing_removed' && report.target_type === 'listing') {
      const listingsUrl = process.env.LISTINGS_SERVICE_URL || 'http://listings-service:3002';
      try {
        await firstValueFrom(this.httpService.put(`${listingsUrl}/listings/${report.target_id}/status`, { status: 'deleted' }, { headers: internalHeaders(), timeout: 5000 }));
      } catch(e) {
        console.error('Failed to remove listing:', e.message);
      }
    } else if ((reviewDto.action_taken === 'user_suspended' || reviewDto.action_taken === 'user_banned') && report.target_type === 'user') {
      const usersUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3007';
      const userStatus = reviewDto.action_taken === 'user_suspended' ? 'suspended' : 'banned';
      try {
        await firstValueFrom(this.httpService.put(`${usersUrl}/users/${report.target_id}/status`, { status: userStatus }, { headers: internalHeaders(), timeout: 5000 }));
      } catch(e) {
        console.error('Failed to update user status:', e.message);
      }
    }

    return saved;
  }

  async getAdminStats() {
    const pending_reports = await this.reportsRepository.count({ where: { status: 'pending' } });
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const qbToday = this.reportsRepository.createQueryBuilder('report').where('report.created_at >= :today', { today });
    const reports_today = await qbToday.getCount();

    const qbResolved = this.reportsRepository.createQueryBuilder('report').where('report.reviewed_at >= :today AND report.status = :status', { today, status: 'resolved' });
    const resolved_today = await qbResolved.getCount();

    const top_reported_listings = await this.reportCountsRepository.find({
      where: { target_type: 'listing' },
      order: { pending_count: 'DESC' },
      take: 5,
    });

    const top_reported_users = await this.reportCountsRepository.find({
      where: { target_type: 'user' },
      order: { pending_count: 'DESC' },
      take: 5,
    });

    return { pending_reports, reports_today, resolved_today, top_reported_listings, top_reported_users };
  }
}
