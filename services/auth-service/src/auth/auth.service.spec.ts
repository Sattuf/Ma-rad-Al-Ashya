import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User, UserRole, UserStatus, AuthProvider } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let redisService: jest.Mocked<RedisService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    phone: '+966500000000',
    fullName: 'Test User',
    avatarUrl: null,
    bio: null,
    isVerified: false,
    isPhoneVerified: false,
    identityVerifiedAt: null,
    locationLat: null,
    locationLng: null,
    city: null,
    passwordHash: 'hashed_password_123',
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
    const mockUsersService = {
      findOneByEmail: jest.fn(),
      findOneByPhone: jest.fn(),
      findOneById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incrWithTtl: jest.fn(),
      deleteByPattern: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    redisService = module.get(RedisService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a user successfully and return tokens', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);
      usersService.findOneByPhone.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      usersService.create.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('token_val');
      redisService.set.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'test@example.com',
        phone: '+966500000000',
        fullName: 'Test User',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.access_token).toBe('token_val');
      expect(usersService.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          fullName: 'Test User',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login successfully and return tokens for correct credentials', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('token_val');
      redisService.set.mockResolvedValue(undefined);

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.access_token).toBe('token_val');
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(redisService.incrWithTtl).toHaveBeenCalledWith('login_failures:test@example.com', 900);
    });

    it('should return the same error for unknown accounts (no user enumeration)', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'nobody@example.com', password: 'whatever1' }),
      ).rejects.toThrow(new UnauthorizedException('بيانات الدخول غير صحيحة'));
      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('should block login after too many failures, even with the right password', async () => {
      redisService.get.mockResolvedValue('5');

      await expect(
        service.login({ identifier: 'test@example.com', password: 'password123' }),
      ).rejects.toMatchObject({ status: 429 });
      expect(usersService.findOneByEmail).not.toHaveBeenCalled();
    });

    it('should reject banned users after a correct password', async () => {
      usersService.findOneByEmail.mockResolvedValue({ ...mockUser, status: UserStatus.BANNED });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ identifier: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleOAuth', () => {
    it('should not link an existing account through an unverified email', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser);
      (usersService as any).findOneByFacebookId = jest.fn().mockResolvedValue(null);

      await expect(
        service.handleOAuth(
          { id: 'fb-1', email: 'test@example.com', emailVerified: false },
          AuthProvider.FACEBOOK,
        ),
      ).rejects.toThrow(ConflictException);
      expect(usersService.update).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should revoke all sessions when a rotated refresh token is reused', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-uuid-123', jti: 'old-jti' });
      redisService.get.mockResolvedValue(null);

      await expect(service.refresh({ refresh_token: 'stolen' })).rejects.toThrow(UnauthorizedException);
      expect(redisService.deleteByPattern).toHaveBeenCalledWith('refresh:user-uuid-123:*');
    });

    it('should refresh tokens successfully and implement rotation', async () => {
      const payload = { sub: 'user-uuid-123', jti: 'token-id-abc' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      redisService.get.mockResolvedValue('valid');
      redisService.del.mockResolvedValue(undefined);
      usersService.findOneById.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('new_token_val');
      redisService.set.mockResolvedValue(undefined);

      const result = await service.refresh({
        refresh_token: 'old_refresh_token_here',
      });

      expect(result.tokens.access_token).toBe('new_token_val');
      expect(redisService.del).toHaveBeenCalledWith('refresh:user-uuid-123:token-id-abc');
      expect(redisService.set).toHaveBeenCalled();
    });
  });
});
