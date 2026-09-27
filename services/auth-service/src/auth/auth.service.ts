import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User, AuthProvider, UserStatus, isBlockedStatus } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { internalHeaders, requireSecret } from '../common/security';

// Per identifier+IP: stops a single attacker quickly without letting anyone lock out a victim.
const LOGIN_MAX_FAILURES_PER_IP = 5;
// Per identifier across all IPs: a high ceiling against distributed guessing.
const LOGIN_MAX_FAILURES_PER_ACCOUNT = 50;
const LOGIN_LOCK_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 3600;
// A second refresh with the same token this soon is a benign race, not theft.
const REFRESH_REUSE_GRACE_MS = 30_000;
// Compared against when the user does not exist, so response time does not reveal registered accounts.
const DUMMY_PASSWORD_HASH = '$2b$12$/FCkfeR4ULkbczjMnwGeveFjV9SRhiegeH7gn7L8RvJ0v2MREQzoi';

export interface OAuthProfile {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string;
  picture?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtAccessSecret = requireSecret('JWT_ACCESS_SECRET');
    this.jwtRefreshSecret = requireSecret('JWT_REFRESH_SECRET');
    if (this.jwtAccessSecret === this.jwtRefreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
  }

  async register(registerDto: RegisterDto, ipAddress: string = ''): Promise<AuthResponseDto> {
    const { email, phone, fullName, password, fingerprint_hash } = registerDto;

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

    // Fire-and-forget fraud check
    const fraudServiceUrl = this.configService.get<string>('FRAUD_SERVICE_URL', 'http://fraud-service:8001');
    const fraudHeaders = { 'Content-Type': 'application/json', ...internalHeaders() };
    setImmediate(() => {
      fetch(`${fraudServiceUrl}/fraud/device/check`, {
        method: 'POST',
        headers: fraudHeaders,
        body: JSON.stringify({
          fingerprint_hash: fingerprint_hash || null,
          ip_address: ipAddress,
          user_id: user.id,
        }),
      }).catch(err => {
        console.error('Failed to send fraud device check', err.message);
      });
    });

    return this.buildAuthResponse(user, tokens);
  }

  async login(loginDto: LoginDto, ipAddress = 'unknown'): Promise<AuthResponseDto> {
    const { identifier, password } = loginDto;
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const accountKey = `login_failures:${normalizedIdentifier}`;
    const ipKey = `login_failures:${normalizedIdentifier}:${ipAddress}`;

    const [accountFailures, ipFailures] = await Promise.all([
      this.redisService.get(accountKey),
      this.redisService.get(ipKey),
    ]);
    if (
      parseInt(ipFailures ?? '0', 10) >= LOGIN_MAX_FAILURES_PER_IP ||
      parseInt(accountFailures ?? '0', 10) >= LOGIN_MAX_FAILURES_PER_ACCOUNT
    ) {
      throw new HttpException(
        'تم إيقاف تسجيل الدخول مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد 15 دقيقة',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let user: User | null = null;
    if (identifier.includes('@')) {
      user = await this.usersService.findOneByEmail(identifier.trim());
    } else {
      user = await this.usersService.findOneByPhone(identifier.trim());
    }

    // Always run bcrypt so unknown accounts and social-only accounts take the same time
    // and return the same message as a wrong password.
    const isPasswordValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !isPasswordValid) {
      await Promise.all([
        this.redisService.incrWithTtl(ipKey, LOGIN_LOCK_SECONDS),
        this.redisService.incrWithTtl(accountKey, LOGIN_LOCK_SECONDS),
      ]);
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    await this.redisService.del(ipKey);

    if (isBlockedStatus(user.status)) {
      throw new UnauthorizedException('هذا الحساب موقوف حالياً');
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
    const usedKey = `refresh_used:${userId}:${tokenId}`;

    // GETDEL: check and consume in one step, so two concurrent requests can never
    // both mint new tokens from the same refresh token.
    const tokenExists = await this.redisService.getAndDelete(redisKey);

    if (!tokenExists) {
      const usedAt = parseInt((await this.redisService.get(usedKey)) ?? '', 10);
      if (Number.isFinite(usedAt) && Date.now() - usedAt > REFRESH_REUSE_GRACE_MS) {
        // A token rotated a while ago is being replayed: assume it was stolen and
        // revoke every session of this user.
        this.logger.warn(`Refresh token reuse detected for user ${userId}; revoking all sessions`);
        await this.redisService.deleteByPattern(`refresh:${userId}:*`);
        throw new UnauthorizedException('تم الكشف عن محاولة استخدام غير مصرح بها. يرجى تسجيل الدخول مجدداً');
      }
      // Within the grace window (parallel tabs / client retry) or after logout: just reject.
      throw new UnauthorizedException('رمز تجديد غير صالح أو منتهي الصلاحية');
    }

    await this.redisService.set(usedKey, String(Date.now()), REFRESH_TTL_SECONDS);

    const user = await this.usersService.findOneById(userId);
    if (!user || isBlockedStatus(user.status)) {
      throw new UnauthorizedException('المستخدم غير موجود أو موقوف');
    }

    const tokens = await this.generateTokensForUser(user);
    return this.buildAuthResponse(user, tokens);
  }

  async logout(userId: string, tokenId: string): Promise<void> {
    const redisKey = `refresh:${userId}:${tokenId}`;
    await this.redisService.del(redisKey);
  }

  /** Revokes the session behind a refresh token, if it belongs to this user. Never throws. */
  async logoutWithRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, { secret: this.jwtRefreshSecret });
      if (payload?.sub === userId && payload.jti) {
        await this.logout(userId, payload.jti);
      }
    } catch {
      // Expired or invalid refresh tokens are already unusable.
    }
  }

  async loginWithoutPassword(user: User): Promise<AuthResponseDto> {
    if (isBlockedStatus(user.status)) {
      throw new UnauthorizedException('هذا الحساب موقوف حالياً');
    }
    const tokens = await this.generateTokensForUser(user);
    return this.buildAuthResponse(user, tokens);
  }

  async handleOAuth(profile: OAuthProfile, provider: AuthProvider): Promise<AuthResponseDto> {
    if (!profile?.id) {
      throw new UnauthorizedException('ملف تعريف مزود الدخول غير صالح');
    }

    let user: User | null = null;

    if (provider === AuthProvider.GOOGLE) {
      user = await this.usersService.findOneByGoogleId(profile.id);
    } else if (provider === AuthProvider.FACEBOOK) {
      user = await this.usersService.findOneByFacebookId(profile.id);
    }

    if (!user) {
      // Only link to an existing account when the provider vouches for the email;
      // otherwise anyone could claim someone else's address and take over the account.
      if (profile.email) {
        user = await this.usersService.findOneByEmail(profile.email);
        if (user && !profile.emailVerified) {
          throw new ConflictException(
            'يوجد حساب مسجل بهذا البريد. سجّل الدخول بطريقتك المعتادة ثم اربط الحساب',
          );
        }
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
          isEmailVerified: !!profile.email && !!profile.emailVerified,
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

  /** Client IDs (web, Android, iOS) whose tokens we accept. */
  private googleClientIds(): string[] {
    const ids = this.configService.get<string>('GOOGLE_CLIENT_IDS') ?? this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '';
    return ids.split(',').map((id) => id.trim()).filter(Boolean);
  }

  async verifyGoogleToken(idToken?: string, accessToken?: string): Promise<AuthResponseDto> {
    const clientIds = this.googleClientIds();
    if (!clientIds.length) {
      throw new ServiceUnavailableException('تسجيل الدخول عبر Google غير مفعّل');
    }

    let profile: OAuthProfile;
    try {
      const client = new OAuth2Client();
      if (idToken) {
        const ticket = await client.verifyIdToken({ idToken, audience: clientIds });
        const payload = ticket.getPayload();
        if (!payload?.sub) throw new Error('empty payload');
        profile = {
          id: payload.sub,
          email: payload.email,
          emailVerified: payload.email_verified === true,
          displayName: payload.name,
          picture: payload.picture,
        };
      } else if (accessToken) {
        // An access token issued to *another* app is still valid at Google, so the
        // audience must be checked explicitly (token substitution attack).
        const info = await client.getTokenInfo(accessToken);
        if (!info.aud || !clientIds.includes(info.aud) || !info.sub) {
          throw new Error('token audience mismatch');
        }
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userInfo = response.ok ? await response.json() : {};
        profile = {
          id: info.sub,
          email: info.email,
          // tokeninfo returns this flag as the string "true", not a boolean.
          emailVerified: String(info.email_verified) === 'true',
          displayName: userInfo.name,
          picture: userInfo.picture,
        };
      } else {
        throw new BadRequestException('idToken or accessToken is required');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Google token verification failed: ${error.message}`);
      throw new UnauthorizedException('فشل التحقق من رمز Google');
    }

    return this.handleOAuth(profile, AuthProvider.GOOGLE);
  }

  async verifyFacebookToken(accessToken: string): Promise<AuthResponseDto> {
    const appId = this.configService.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('تسجيل الدخول عبر Facebook غير مفعّل');
    }

    let profile: OAuthProfile;
    try {
      // Confirm the token was issued to our app before trusting it.
      const debugUrl = new URL('https://graph.facebook.com/debug_token');
      debugUrl.searchParams.set('input_token', accessToken);
      debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);
      const debugRes = await fetch(debugUrl);
      const debug = debugRes.ok ? (await debugRes.json()).data : null;
      if (!debug?.is_valid || debug.app_id !== appId || !debug.user_id) {
        throw new Error('token not issued for this app');
      }

      const meUrl = new URL('https://graph.facebook.com/me');
      meUrl.searchParams.set('fields', 'id,name,email,picture');
      meUrl.searchParams.set('access_token', accessToken);
      const meRes = await fetch(meUrl);
      if (!meRes.ok) throw new Error('profile request failed');
      const data = await meRes.json();
      if (data.id !== debug.user_id) throw new Error('profile/token user mismatch');

      profile = {
        id: data.id,
        email: data.email,
        // Facebook does not guarantee the email is verified, so it is never used to link accounts.
        emailVerified: false,
        displayName: data.name,
        picture: data.picture?.data?.url,
      };
    } catch (error) {
      this.logger.warn(`Facebook token verification failed: ${error.message}`);
      throw new UnauthorizedException('فشل التحقق من رمز Facebook');
    }

    return this.handleOAuth(profile, AuthProvider.FACEBOOK);
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

    const redisKey = `refresh:${user.id}:${tokenId}`;
    await this.redisService.set(redisKey, 'valid', REFRESH_TTL_SECONDS);

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
