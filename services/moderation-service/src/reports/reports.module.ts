import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Report } from './entities/report.entity';
import { ReportCount } from './entities/report-count.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportCount]),
    BullModule.registerQueue({
      name: 'auto-review',
    }),
    HttpModule
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
