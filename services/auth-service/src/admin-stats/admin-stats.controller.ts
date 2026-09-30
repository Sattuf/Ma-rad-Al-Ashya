import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../common/security';
import { AdminStatsService } from './admin-stats.service';
import { parseStatsWindow } from '../common/stats';

// Gateway strips "/auth": public path is /api/v1/auth/admin/stats.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'User growth KPIs for the admin dashboard (cached 60s)' })
  getStats(@Query('days') days?: string) {
    return this.stats.getStats(parseStatsWindow(days));
  }
}
