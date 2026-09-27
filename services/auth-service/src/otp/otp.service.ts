import { Injectable, HttpException, HttpStatus, Inject, forwardRef, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { safeEqual } from '../common/security';
import * as twilio from 'twilio';

export const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_SECONDS = 15 * 60;
const OTP_CODE_TTL_SECONDS = 5 * 60;
const OTP_RESEND_SECONDS = 60;
const OTP_DAILY_SEND_LIMIT = 10;

@Injectable()
export class OtpService {
  private twilioClient: twilio.Twilio | null = null;
  private verifyServiceSid: string | null = null;
  private readonly mockEnabled: boolean;
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') || null;

    // Mock OTP is a development convenience only. It must be opted into explicitly
    // and can never be active in production, where it would let anyone sign in as any phone.
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.mockEnabled = !isProduction && this.configService.get<string>('OTP_MOCK_ENABLED') === 'true';

    if (accountSid && authToken) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
      } catch (err) {
        this.logger.error(`Failed to initialize Twilio client: ${err.message}`);
      }
    }

    if (!this.isTwilioActive() && !this.mockEnabled) {
      this.logger.warn('No OTP provider configured: phone verification is disabled');
    }
  }

  private isTwilioActive(): boolean {
    return !!(this.twilioClient && this.verifyServiceSid);
  }

  private otpUnavailable(): HttpException {
    return new HttpException('خدمة رسائل التحقق غير متاحة حالياً', HttpStatus.SERVICE_UNAVAILABLE);
  }

  async sendOtp(phone: string): Promise<{ message: string; mockCode?: string }> {
    if (!this.isTwilioActive() && !this.mockEnabled) {
      throw this.otpUnavailable();
    }

    const lockKey = `otp_lock:${phone}`;
    if (await this.redisService.get(lockKey)) {
      throw new HttpException(
        'هذا الرقم مقفل مؤقتاً بسبب محاولات خاطئة متكررة. الرجاء المحاولة لاحقاً',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Atomic: two concurrent requests cannot both pass the resend window.
    const acquired = await this.redisService.setIfAbsent(`otp_send_limit:${phone}`, '1', OTP_RESEND_SECONDS);
    if (!acquired) {
      throw new HttpException(
        'الرجاء الانتظار دقيقة واحدة قبل طلب رمز تحقق جديد',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Daily cap limits SMS pumping (toll fraud) against a single number.
    const sentToday = await this.redisService.incrWithTtl(`otp_daily:${phone}`, 24 * 3600);
    if (sentToday > OTP_DAILY_SEND_LIMIT) {
      throw new HttpException(
        'تم تجاوز الحد اليومي لطلبات رمز التحقق لهذا الرقم',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.isTwilioActive()) {
      return this.sendMockOtp(phone);
    }

    try {
      await this.twilioClient!.verify.v2
        .services(this.verifyServiceSid!)
        .verifications.create({ to: phone, channel: 'sms' });
      return { message: 'تم إرسال رمز التحقق بنجاح عبر الرسائل النصية' };
    } catch (error) {
      this.logger.error(`Twilio send OTP failed: ${error.message}`);
      throw new HttpException('فشل إرسال رمز التحقق. الرجاء المحاولة لاحقاً', HttpStatus.BAD_GATEWAY);
    }
  }

  private async sendMockOtp(phone: string): Promise<{ message: string; mockCode: string }> {
    const mockCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redisService.set(`otp_code:${phone}`, mockCode, OTP_CODE_TTL_SECONDS);
    this.logger.log(`[MOCK OTP] Issued code for phone ending ${phone.slice(-4)}`);

    return {
      message: 'تم إرسال رمز تحقق افتراضي (بيئة تطوير)',
      mockCode,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<any> {
    if (!this.isTwilioActive() && !this.mockEnabled) {
      throw this.otpUnavailable();
    }

    const lockKey = `otp_lock:${phone}`;
    const attemptsKey = `otp_attempts:${phone}`;

    if (await this.redisService.get(lockKey)) {
      throw new HttpException(
        'تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. الرجاء المحاولة بعد 15 دقيقة',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Count the attempt *before* checking the code so parallel guesses cannot
    // slip past the limit (the previous get/set pair was racy).
    const attempts = await this.redisService.incrWithTtl(attemptsKey, OTP_LOCK_SECONDS);
    if (attempts > OTP_MAX_ATTEMPTS) {
      await this.lockPhone(lockKey, attemptsKey);
      throw new HttpException(
        'تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. الرجاء المحاولة بعد 15 دقيقة',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isVerified = this.isTwilioActive()
      ? await this.verifyWithTwilio(phone, code)
      : await this.verifyMockOtp(phone, code);

    if (!isVerified) {
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      if (remaining <= 0) {
        await this.lockPhone(lockKey, attemptsKey);
        throw new HttpException(
          'رمز غير صحيح. تم قفل هذا الرقم مؤقتاً لمدة 15 دقيقة بسبب كثرة المحاولات الخاطئة',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        `رمز التحقق غير صحيح. المحاولات المتبقية: ${remaining}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.redisService.del(attemptsKey);
    await this.redisService.del(`otp_code:${phone}`);

    let user = await this.usersService.findOneByPhone(phone);
    if (!user) {
      user = await this.usersService.create({
        phone,
        fullName: `مستخدم ${phone.slice(-4)}`,
        isPhoneVerified: true,
        isVerified: false,
        preferredLanguage: 'ar',
      });
    } else if (!user.isPhoneVerified) {
      user = await this.usersService.update(user.id, { isPhoneVerified: true });
    }

    return this.authService.loginWithoutPassword(user);
  }

  private async lockPhone(lockKey: string, attemptsKey: string): Promise<void> {
    await this.redisService.set(lockKey, '1', OTP_LOCK_SECONDS);
    await this.redisService.del(attemptsKey);
  }

  private async verifyWithTwilio(phone: string, code: string): Promise<boolean> {
    try {
      const check = await this.twilioClient!.verify.v2
        .services(this.verifyServiceSid!)
        .verificationChecks.create({ to: phone, code });
      return check.status === 'approved';
    } catch (error) {
      this.logger.error(`Twilio verify OTP failed: ${error.message}`);
      throw new HttpException('فشل التحقق من الرمز. الرجاء المحاولة لاحقاً', HttpStatus.BAD_GATEWAY);
    }
  }

  private async verifyMockOtp(phone: string, code: string): Promise<boolean> {
    const storedCode = await this.redisService.get(`otp_code:${phone}`);
    return !!storedCode && safeEqual(code, storedCode);
  }
}
