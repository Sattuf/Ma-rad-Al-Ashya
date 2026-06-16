import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { KycVerification } from './entities/kyc-verification.entity';
import { KycAuditLog } from './entities/kyc-audit-log.entity';

import { KycController } from './controllers/kyc.controller';

import { KycService } from './services/kyc.service';
import { DiditService } from './services/didit.service';
import { KmsService } from './services/kms.service';
import { KycCronService } from './services/kyc-cron.service';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://marad_user:marad_dev_password@localhost:5432/marad_db',
      entities: [KycVerification, KycAuditLog],
      synchronize: false, // Migrations will handle DB schema
    }),
    TypeOrmModule.forFeature([KycVerification, KycAuditLog]),
    HttpModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController, KycController],
  providers: [AppService, KycService, DiditService, KmsService, KycCronService],
})
export class AppModule {}
