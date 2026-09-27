import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('reports')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new report' })
  createReport(@Request() req, @Body() createReportDto: CreateReportDto) {
    return this.reportsService.createReport(req.user.userId, createReportDto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user reports' })
  getMyReports(@Request() req, @Query('page') page: string, @Query('limit') limit: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reportsService.getMyReports(req.user.userId, pageNum, limitNum);
  }
}
