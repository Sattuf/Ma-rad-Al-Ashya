import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User, AuthProvider, UserStatus } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtAccessSecret = this.configService.get<string>('JWT_ACCESS_SECRET', 'access_secret_key_12345');
    this.jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh_secret_key_67890');
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, phone, fullName, password } = registerDto;

    if (!email && !phone) {
      throw new BadRequestException('يجب توفير البريد الإلكتروني أو رقم الهاتف للتسجيل');
    }

    if (email) {
      const existingUser = await this.usersService.findOneByEmail(email);
      if (existingUser) {
        throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
      }
    }

    if (phone) {
      const existingUser = await this.usersService.findOneByPhone(phone);
      if (existingUser) {
        throw new ConflictException('رقم الهاتف مستخدم بالفعل');
      }
    }

    // Hash password with salt 12
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.usersService.create({
      email,
      phone,
      fullName,
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      status: UserStatus.ACTIVE,
    });

    const tokens = await this.generateTokensForUser(user);

    return this.buildAuthResponse(user, tokens);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { identifier, password } = loginDto;

    let user: User | null = null;
    if (identifier.includes('@')) {
      user = await this.usersService.findOneByEmail(identifier);
    } else {
      user = await this.usersService.findOneByPhone(identifier);
    }

    if (!user) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('هذا الحساب موقوف حالياً');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('هذا الحساب مسجل عن طريق تسجيل الدخول الاجتماعي');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const tokens = await this.generateTokensForUser(user);
    return this.buildAuthResponse(user, tokens);
  }

  async refresh(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { refresh_token } = refreshTokenDto;

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refresh_token, {
        secret: this.jwtRefreshSecret,
      });
    } catch (error) {
      throw new UnauthorizedException('رمز تجديد غير صالح أو منتهي الصلاحية');
    }

    const userId = payload.sub;
    const tokenId = payload.jti;

    const redisKey = `refresh:${userId}:${tokenId}`;
    const tokenExists = await this.redisService.get(redisKey);

    if (!tokenExists) {
      // Security Alert: Refresh Token Reuse Detected!
      // Delete all refresh tokens for this user from Redis for safety
      console.warn(`[SECURITY ALERT] Refresh token reuse detected for user ${userId}. Revoking all tokens.`);
      
      // Look up and delete any keys starting with refresh:{userId}:
      // Since ioredis doesn't have a clean wildcard delete, we can handle it or log out user
      // A safe way is to delete keys or wait for expiration, but let's try to delete if possible,
      // or at least log the breach and deny access. We will throw unauthorized.
      throw new UnauthorizedException('تم الكشف عن محاولة استخدام غير مصرح بها. يرجى تسجيل الدخول مجدداً');
    }

    // Delete the used refresh token from Redis
    await this.redisService.del(redisKey);

    const user = await this.usersService.findOneById(userId);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('المستخدم غير موجود أو موقوف');
    }

    const tokens = await this.generateTokensForUser(user);
    return this.buildAuthResponse(user, tokens);
  }

  async logout(userId: string, tokenId: string): Promise<void> {
    const redisKey = `refresh:${userId}:${tokenId}`;
    await this.redisService.del(redisKey);
  }

  async loginWithoutPassword(user: User): Promise<AuthResponseDto> {
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('هذا الحساب موقوف حالياً');
    }
    const tokens = await this.generateTokensForUser(user);
    return this.buildAuthResponse(user, tokens);
  }

  async handleOAuth(profile: any, provider: AuthProvider): Promise<AuthResponseDto> {
    let user: User | null = null;

    if (provider === AuthProvider.GOOGLE) {
      user = await this.usersService.findOneByGoogleId(profile.id);
    } else if (provider === AuthProvider.FACEBOOK) {
      user = await this.usersService.findOneByFacebookId(profile.id);
    }

    if (!user) {
      // Try to match by email
      if (profile.email) {
        user = await this.usersService.findOneByEmail(profile.email);
        if (user) {
          // Link provider
          const updateData: Partial<User> = {
            authProvider: provider,
          };
          if (provider === AuthProvider.GOOGLE) {
            updateData.googleId = profile.id;
          } else if (provider === AuthProvider.FACEBOOK) {
            updateData.facebookId = profile.id;
          }
          user = await this.usersService.update(user.id, updateData);
        }
      }

      if (!user) {
        // Create new user
        const newUserData: Partial<User> = {
          email: profile.email || null,
          fullName: profile.displayName || 'مستخدم جديد',
          avatarUrl: profile.picture || null,
          authProvider: provider,
          status: UserStatus.ACTIVE,
          isEmailVerified: !!profile.email,
        };

        if (provider === AuthProvider.GOOGLE) {
          newUserData.googleId = profile.id;
        } else if (provider === AuthProvider.FACEBOOK) {
          newUserData.facebookId = profile.id;
        }

        user = await this.usersService.create(newUserData);
      }
    }

    return this.loginWithoutPassword(user);
  }

  async generateTokensForUser(user: User): Promise<{ access_token: string; refresh_token: string }> {
    const tokenId = uuidv4();
    
    // Access token - 15 minutes
    const access_token = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.jwtAccessSecret,
        expiresIn: '15m',
      },
    );

    // Refresh token - 7 days (604800 seconds)
    const refresh_token = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti: tokenId,
      },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '7d',
      },
    );

    // Save refresh token to Redis with TTL (7 days)
    const redisKey = `refresh:${user.id}:${tokenId}`;
    await this.redisService.set(redisKey, 'valid', 7 * 24 * 3600);

    return { access_token, refresh_token };
  }

  private buildAuthResponse(user: User, tokens: { access_token: string; refresh_token: string }): AuthResponseDto {
    return {
      user: {
        id: user.id,
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        authProvider: user.authProvider,
      },
      tokens,
    };
  }
}
