import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { User, UserRole, UserStatus, AuthProvider } from '../users/entities/user.entity';

describe('OtpService', () => {
  let service: OtpService;
  let redisService: jest.Mocked<RedisService>;
  let usersService: jest.Mocked<UsersService>;
  let authService: jest.Mocked<AuthService>;

  const mockPhone = '+966500000000';
  const mockUser: User = {
    id: 'user-uuid-123',
    email: null,
    phone: mockPhone,
    fullName: 'مستخدم 0000',
    avatarUrl: null,
    bio: null,
    isVerified: false,
    isPhoneVerified: true,
    identityVerifiedAt: null,
    locationLat: null,
    locationLng: null,
    city: null,
    passwordHash: null,
    provider: 'local',
    providerId: null,
    fcmToken: null,
    preferredLanguage: 'ar',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: false,
    googleId: null,
    facebookId: null,
    authProvider: AuthProvider.LOCAL,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let config: Record<string, string>;

  const buildService = async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      setIfAbsent: jest.fn().mockResolvedValue(true),
      incrWithTtl: jest.fn().mockResolvedValue(1),
      deleteByPattern: jest.fn(),
    };

    const mockUsersService = {
      findOneByPhone: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockAuthService = {
      loginWithoutPassword: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => config[key] ?? defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    redisService = module.get(RedisService);
    usersService = module.get(UsersService);
    authService = module.get(AuthService);
  };

  beforeEach(async () => {
    config = { NODE_ENV: 'development', OTP_MOCK_ENABLED: 'true' };
    await buildService();
  });

  describe('mock mode safety', () => {
    it('refuses to send OTP in production without a real provider, even if mock is requested', async () => {
      config = { NODE_ENV: 'production', OTP_MOCK_ENABLED: 'true' };
      await buildService();

      await expect(service.sendOtp(mockPhone)).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
      await expect(service.verifyOtp(mockPhone, '123456')).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
      expect(authService.loginWithoutPassword).not.toHaveBeenCalled();
    });

    it('refuses OTP when mock mode is not explicitly enabled', async () => {
      config = { NODE_ENV: 'development' };
      await buildService();

      await expect(service.sendOtp(mockPhone)).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    });
  });

  describe('sendOtp', () => {
    it('should issue a random 6-digit code in mock mode', async () => {
      redisService.get.mockResolvedValue(null);

      const result = await service.sendOtp(mockPhone);

      expect(result.message).toContain('رمز تحقق افتراضي');
      expect(result.mockCode).toMatch(/^\d{6}$/);
      expect(redisService.set).toHaveBeenCalledWith(`otp_code:${mockPhone}`, result.mockCode, 300);
      expect(redisService.setIfAbsent).toHaveBeenCalledWith(`otp_send_limit:${mockPhone}`, '1', 60);
    });

    it('should throw HttpException (429) if requested within 60 seconds', async () => {
      redisService.get.mockResolvedValue(null);
      (redisService.setIfAbsent as jest.Mock).mockResolvedValue(false);

      await expect(service.sendOtp(mockPhone)).rejects.toThrow(
        new HttpException('الرجاء الانتظار دقيقة واحدة قبل طلب رمز تحقق جديد', HttpStatus.TOO_MANY_REQUESTS),
      );
    });

    it('should enforce the daily send cap', async () => {
      redisService.get.mockResolvedValue(null);
      (redisService.incrWithTtl as jest.Mock).mockResolvedValue(11);

      await expect(service.sendOtp(mockPhone)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully and return login tokens', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '482913';
        return null;
      });
      usersService.findOneByPhone.mockResolvedValue(mockUser);
      authService.loginWithoutPassword.mockResolvedValue({
        user: { id: mockUser.id, phone: mockPhone, fullName: mockUser.fullName } as any,
        tokens: { access_token: 'access_val', refresh_token: 'refresh_val' },
      });

      const result = await service.verifyOtp(mockPhone, '482913');

      expect(result.tokens.access_token).toBe('access_val');
      expect(redisService.del).toHaveBeenCalledWith(`otp_code:${mockPhone}`);
      expect(authService.loginWithoutPassword).toHaveBeenCalledWith(mockUser);
    });

    it('should not accept the old static code 123456', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '482913';
        return null;
      });

      await expect(service.verifyOtp(mockPhone, '123456')).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(authService.loginWithoutPassword).not.toHaveBeenCalled();
    });

    it('should reject when no code was issued', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(service.verifyOtp(mockPhone, '123456')).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('should count the attempt atomically and report remaining attempts', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '482913';
        return null;
      });
      (redisService.incrWithTtl as jest.Mock).mockResolvedValue(3);

      await expect(service.verifyOtp(mockPhone, '000000')).rejects.toThrow(
        new HttpException('رمز التحقق غير صحيح. المحاولات المتبقية: 2', HttpStatus.BAD_REQUEST),
      );
      expect(redisService.incrWithTtl).toHaveBeenCalledWith(`otp_attempts:${mockPhone}`, 900);
    });

    it('should lock the number for 15 minutes on the 5th failed attempt', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '482913';
        return null;
      });
      (redisService.incrWithTtl as jest.Mock).mockResolvedValue(5);

      await expect(service.verifyOtp(mockPhone, '000000')).rejects.toThrow(
        new HttpException(
          'رمز غير صحيح. تم قفل هذا الرقم مؤقتاً لمدة 15 دقيقة بسبب كثرة المحاولات الخاطئة',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
      expect(redisService.set).toHaveBeenCalledWith(`otp_lock:${mockPhone}`, '1', 900);
      expect(redisService.del).toHaveBeenCalledWith(`otp_attempts:${mockPhone}`);
    });

    it('should refuse even a correct code once attempts are exhausted (parallel guessing)', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '482913';
        return null;
      });
      (redisService.incrWithTtl as jest.Mock).mockResolvedValue(6);

      await expect(service.verifyOtp(mockPhone, '482913')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      expect(authService.loginWithoutPassword).not.toHaveBeenCalled();
    });
      it('drops the password of an unverified pre-registered account on first phone proof', async () => {
      redisService.get.mockImplementation(async (key: string) => (key === `otp_code:${mockPhone}` ? '482913' : null));
      usersService.findOneByPhone.mockResolvedValue({ ...mockUser, isPhoneVerified: false, passwordHash: 'attacker' });
      usersService.update.mockResolvedValue({ ...mockUser, isPhoneVerified: true, passwordHash: null });

      await service.verifyOtp(mockPhone, '482913');

      expect(usersService.update).toHaveBeenCalledWith(mockUser.id, { isPhoneVerified: true, passwordHash: null });
      expect((redisService as any).deleteByPattern).toHaveBeenCalledWith(`refresh:${mockUser.id}:*`);
    });
  });
});
