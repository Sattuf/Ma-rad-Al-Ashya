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

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
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
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        return defaultValue;
      }),
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

    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    it('should send OTP successfully in mock mode', async () => {
      redisService.get.mockResolvedValue(null); // No rate limit, no lock
      redisService.set.mockResolvedValue(undefined);

      const result = await service.sendOtp(mockPhone);

      expect(result.message).toContain('رمز تحقق افتراضي');
      expect(result.mockCode).toBe('123456');
      expect(redisService.set).toHaveBeenCalledWith(`otp_code:${mockPhone}`, '123456', 300);
      expect(redisService.set).toHaveBeenCalledWith(`otp_send_limit:${mockPhone}`, '1', 60);
    });

    it('should throw HttpException (429) if requested within 60 seconds', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key.startsWith('otp_send_limit:')) return '1';
        return null;
      });

      await expect(service.sendOtp(mockPhone)).rejects.toThrow(
        new HttpException('الرجاء الانتظار دقيقة واحدة قبل طلب رمز تحقق جديد', HttpStatus.TOO_MANY_REQUESTS),
      );
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully and return login tokens', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '123456';
        return null; // Not locked
      });
      redisService.del.mockResolvedValue(undefined);
      usersService.findOneByPhone.mockResolvedValue(mockUser);
      authService.loginWithoutPassword.mockResolvedValue({
        user: { id: mockUser.id, phone: mockPhone, fullName: mockUser.fullName } as any,
        tokens: { access_token: 'access_val', refresh_token: 'refresh_val' },
      });

      const result = await service.verifyOtp(mockPhone, '123456');

      expect(result.tokens.access_token).toBe('access_val');
      expect(redisService.del).toHaveBeenCalledWith(`otp_code:${mockPhone}`);
      expect(authService.loginWithoutPassword).toHaveBeenCalledWith(mockUser);
    });

    it('should increment attempts on incorrect verification code', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '123456';
        if (key === `otp_attempts:${mockPhone}`) return '2';
        return null; // Not locked
      });
      redisService.set.mockResolvedValue(undefined);

      await expect(service.verifyOtp(mockPhone, 'wrong_code')).rejects.toThrow(
        new HttpException('رمز التحقق غير صحيح. المحاولات المتبقية: 2', HttpStatus.BAD_REQUEST),
      );

      // Verify that attempts count is incremented (from 2 to 3)
      expect(redisService.set).toHaveBeenCalledWith(`otp_attempts:${mockPhone}`, '3', 300);
    });

    it('should lock the account for 15 minutes after 5 failed attempts', async () => {
      redisService.get.mockImplementation(async (key: string) => {
        if (key === `otp_code:${mockPhone}`) return '123456';
        if (key === `otp_attempts:${mockPhone}`) return '4';
        return null; // Not locked
      });
      redisService.set.mockResolvedValue(undefined);
      redisService.del.mockResolvedValue(undefined);

      await expect(service.verifyOtp(mockPhone, 'wrong_code')).rejects.toThrow(
        new HttpException(
          'رمز غير صحيح. تم قفل هذا الرقم مؤقتاً لمدة 15 دقيقة بسبب كثرة المحاولات الخاطئة',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      // Verify that lock is set
      expect(redisService.set).toHaveBeenCalledWith(`otp_lock:${mockPhone}`, '1', 900);
      expect(redisService.del).toHaveBeenCalledWith(`otp_attempts:${mockPhone}`);
    });
  });
});
