import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import * as twilio from 'twilio';

@Injectable()
export class OtpService {
  private twilioClient: twilio.Twilio | null = null;
  private verifyServiceSid: string | null = null;

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

    if (accountSid && authToken && accountSid !== 'mock' && authToken !== 'mock') {
      try {
        this.twilioClient = twilio(accountSid, authToken);
      } catch (err) {
        console.warn('Failed to initialize Twilio client, using Mock OTP:', err.message);
      }
    }
  }

  private isTwilioActive(): boolean {
    return !!(this.twilioClient && this.verifyServiceSid);
  }

  async sendOtp(phone: string): Promise<{ message: string; mockCode?: string }> {
    // 1. Rate limiting check (max 1 request per 60 seconds)
    const limitKey = `otp_send_limit:${phone}`;
    const isLimited = await this.redisService.get(limitKey);
    if (isLimited) {
      throw new HttpException(
        'الرجاء الانتظار دقيقة واحدة قبل طلب رمز تحقق جديد',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set rate limit key for 60 seconds
    await this.redisService.set(limitKey, '1', 60);

    // 2. Check if phone is locked
    const lockKey = `otp_lock:${phone}`;
    const isLocked = await this.redisService.get(lockKey);
    if (isLocked) {
      throw new HttpException(
        'هذا الرقم مقفل مؤقتاً بسبب محاولات خاطئة متكررة. الرجاء المحاولة لاحقاً',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const client = this.twilioClient;
    const sid = this.verifyServiceSid;

    if (client && sid) {
      try {
        await client.verify.v2
          .services(sid)
          .verifications.create({ to: phone, channel: 'sms' });
        return { message: 'تم إرسال رمز التحقق بنجاح عبر الرسائل النصية' };
      } catch (error) {
        console.error('Twilio Send OTP Error:', error);
        // Fallback to mock in dev mode if Twilio fails
        if (this.configService.get<string>('NODE_ENV') === 'development') {
          return this.sendMockOtp(phone);
        }
        throw new HttpException(
          'فشل إرسال رمز التحقق. الرجاء المحاولة لاحقاً',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } else {
      return this.sendMockOtp(phone);
    }
  }

  private async sendMockOtp(phone: string): Promise<{ message: string; mockCode: string }> {
    const mockCode = '123456'; // Default static mock code for simplicity, or random if needed
    const codeKey = `otp_code:${phone}`;
    
    // Store in redis for 5 minutes (300 seconds)
    await this.redisService.set(codeKey, mockCode, 300);
    console.log(`[MOCK OTP] Sent code "${mockCode}" to phone "${phone}"`);
    
    return {
      message: 'تم إرسال رمز تحقق افتراضي (بيئة تطوير)',
      mockCode,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<any> {
    // 1. Check lock status
    const lockKey = `otp_lock:${phone}`;
    const isLocked = await this.redisService.get(lockKey);
    if (isLocked) {
      throw new HttpException(
        'تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. الرجاء المحاولة بعد 15 دقيقة',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let isVerified = false;

    const verifyClient = this.twilioClient;
    const verifySid = this.verifyServiceSid;

    if (verifyClient && verifySid) {
      try {
        const check = await verifyClient.verify.v2
          .services(verifySid)
          .verificationChecks.create({ to: phone, code });
        isVerified = check.status === 'approved';
      } catch (error) {
        console.error('Twilio Verify OTP Error:', error);
        // Fallback to mock verification in dev mode if Twilio fails
        if (this.configService.get<string>('NODE_ENV') === 'development') {
          isVerified = await this.verifyMockOtp(phone, code);
        } else {
          throw new HttpException(
            'فشل التحقق من الرمز. الرجاء المحاولة لاحقاً',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
    } else {
      isVerified = await this.verifyMockOtp(phone, code);
    }

    if (!isVerified) {
      // Increment failed attempts
      const attemptsKey = `otp_attempts:${phone}`;
      const attemptsStr = await this.redisService.get(attemptsKey);
      let attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
      attempts++;

      if (attempts >= 5) {
        // Lock for 15 minutes (900 seconds)
        await this.redisService.set(lockKey, '1', 900);
        await this.redisService.del(attemptsKey);
        throw new HttpException(
          'رمز غير صحيح. تم قفل هذا الرقم مؤقتاً لمدة 15 دقيقة بسبب كثرة المحاولات الخاطئة',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        await this.redisService.set(attemptsKey, attempts.toString(), 300);
        throw new HttpException(
          `رمز التحقق غير صحيح. المحاولات المتبقية: ${5 - attempts}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Success: Clear Redis keys
    await this.redisService.del(lockKey);
    await this.redisService.del(`otp_attempts:${phone}`);
    await this.redisService.del(`otp_code:${phone}`);

    // Find or create user
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

    // Generate tokens
    return this.authService.loginWithoutPassword(user);
  }

  private async verifyMockOtp(phone: string, code: string): Promise<boolean> {
    const codeKey = `otp_code:${phone}`;
    const storedCode = await this.redisService.get(codeKey);
    return storedCode === code;
  }
}
