import { Controller, Get, Put, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { parseStatsWindow } from '../common/stats';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('admin')
@Controller()
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('reports')
  @ApiOperation({ summary: 'Get all reports' })
  getReports(@Query() query: any) {
    return this.reportsService.getAdminReports(query);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get report detail' })
  getReportDetail(@Param('id') id: string) {
    return this.reportsService.getReportDetail(id);
  }

  @Put('reports/:id/review')
  @ApiOperation({ summary: 'Review a report' })
  reviewReport(@Param('id') id: string, @Body() body: any, @Request() req) {
    return this.reportsService.reviewReport(id, body, req.user.userId);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard stats' })
  getDashboardStats(@Query('days') days?: string) {
    return this.reportsService.getAdminStats(parseStatsWindow(days));
  }
}
