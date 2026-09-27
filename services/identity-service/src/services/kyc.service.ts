import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycVerification } from '../entities/kyc-verification.entity';
import { KycAuditLog } from '../entities/kyc-audit-log.entity';
import { DiditService } from './didit.service';
import { KmsService } from './kms.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { internalHeaders } from '../common/security';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycVerificationRepo: Repository<KycVerification>,
    @InjectRepository(KycAuditLog)
    private readonly auditLogRepo: Repository<KycAuditLog>,
    private readonly diditService: DiditService,
    private readonly kmsService: KmsService,
    private readonly httpService: HttpService,
  ) {}

  async startVerification(userId: string, ipAddress: string) {
    // Call Didit API to create session
    const { sessionId, sessionUrl } = await this.diditService.createSession(userId);

    // Save to DB
    const verification = this.kycVerificationRepo.create({
      user_id: userId,
      session_id: sessionId,
      status: 'pending',
      // Expires in 1 day
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await this.kycVerificationRepo.save(verification);

    // Log audit
    await this.logAudit(userId, 'KYC_STARTED', { sessionId }, ipAddress);

    return { sessionUrl, sessionId };
  }

  async getStatus(userId: string) {
    const verifications = await this.kycVerificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 1,
    });

    if (!verifications.length) {
      return { status: 'none' };
    }

    return { status: verifications[0].status };
  }

  /** Called only after the controller verified the vendor's HMAC signature. */
  async handleWebhook(body: any, ipAddress?: string) {
    const sessionId = body?.session_id;
    const status = body?.status;
    if (typeof sessionId !== 'string' || typeof status !== 'string' || status.length > 50) {
      this.logger.warn('Webhook with missing session or status ignored');
      return;
    }

    const verification = await this.kycVerificationRepo.findOne({ where: { session_id: sessionId } });
    if (!verification) {
      this.logger.warn(`Webhook received for unknown session: ${sessionId}`);
      return;
    }

    // Encrypt sensitive vendor data
    const { encryptedData, keyId } = await this.kmsService.encrypt(body);
    
    verification.status = status;
    verification.encrypted_data = encryptedData;
    verification.kms_key_id = keyId;
    await this.kycVerificationRepo.save(verification);

    await this.logAudit(verification.user_id, 'KYC_WEBHOOK_RECEIVED', { status }, ipAddress);

    if (status === 'Approved') {
      await this.notifyUsersService(verification.user_id);
    }
  }

  async getSessionData(sessionId: string) {
    const verification = await this.kycVerificationRepo.findOne({ where: { session_id: sessionId } });
    if (!verification) throw new NotFoundException('Session not found');

    return {
      userId: verification.user_id,
      status: verification.status,
      createdAt: verification.created_at,
    };
  }

  async decryptData(sessionId: string, adminId: string) {
    if (typeof sessionId !== 'string') throw new NotFoundException('Session not found');
    const verification = await this.kycVerificationRepo.findOne({ where: { session_id: sessionId } });
    if (!verification || !verification.encrypted_data) {
      throw new NotFoundException('Data not found or not encrypted');
    }

    const decrypted = await this.kmsService.decrypt(verification.encrypted_data, verification.kms_key_id);
    
    await this.logAudit(verification.user_id, 'KYC_DATA_DECRYPTED', { sessionId, adminId }, 'admin');

    return decrypted;
  }

  private async notifyUsersService(userId: string) {
    try {
      const usersServiceUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3007';
      await firstValueFrom(
        this.httpService.put(`${usersServiceUrl}/users/${userId}/verify`, {}, { headers: internalHeaders(), timeout: 5000 })
      );
      this.logger.log(`Notified users service to verify user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to notify users service: ${error.message}`);
    }
  }

  private async logAudit(userId: string, action: string, details: any, ipAddress?: string) {
    const log = this.auditLogRepo.create({
      user_id: userId,
      action,
      details,
      ip_address: ipAddress,
    });
    await this.auditLogRepo.save(log);
  }

  async markExpiredSessions() {
    const now = new Date();
    const result = await this.kycVerificationRepo.createQueryBuilder()
      .update(KycVerification)
      .set({ status: 'expired' })
      .where('status = :status AND expires_at < :now', { status: 'pending', now })
      .execute();
      
    if (result.affected && result.affected > 0) {
      this.logger.log(`Marked ${result.affected} KYC sessions as expired.`);
    }
  }
}
