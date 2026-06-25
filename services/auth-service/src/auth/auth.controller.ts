import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Ip,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { AuthProvider } from '../users/entities/user.entity';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'تسجيل مستخدم جديد — Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto, description: 'تم إنشاء الحساب بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 409, description: 'البريد الإلكتروني أو الهاتف مستخدم بالفعل' })
  async register(@Body() registerDto: RegisterDto, @Ip() ipAddress: string) {
    return this.authService.register(registerDto, ipAddress);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الدخول — User login' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'تم تسجيل الدخول بنجاح' })
  @ApiResponse({ status: 401, description: 'بيانات الدخول غير صحيحة' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تجديد رمز الجلسة — Refresh JWT tokens' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'تم تجديد الرموز بنجاح' })
  @ApiResponse({ status: 401, description: 'رمز تجديد غير صالح أو مستخدم مسبقاً' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الخروج — Logout' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الخروج بنجاح' })
  async logout(@Req() req: any, @Body() body: RefreshTokenDto) {
    const userId = req.user.id;
    try {
      // Decode and extract token ID
      const jwtService = req.jwtService; // if we want to decode, we can decode without verifying secret for deletion,
      // or we can decode via authService. We'll verify inside AuthService.
      // Let's pass the refresh token to authService to handle deletion.
      // Wait, we can add a decode function in jwtService.
      // We will parse the token manually or use jwtService.
      // To be safe, let's let AuthService handle the decoding/validation of refresh token for logout.
      // We can create a method `authService.logout(userId, refresh_token)`
      // Let's implement that!
      const payload = req.authInfo || {}; // passport strategy can set authInfo,
      // or we just decode the token:
      const jwtDecoded = this.authService['jwtService'].decode(body.refresh_token) as any;
      if (jwtDecoded && jwtDecoded.sub === userId) {
        await this.authService.logout(userId, jwtDecoded.jti);
      }
    } catch (error) {
      // Suppress error and return ok
    }
    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'بيانات المستخدم الحالي — Current profile' })
  @ApiResponse({ status: 200, description: 'تم استرجاع البيانات بنجاح' })
  async me(@Req() req: any) {
    return { user: req.user };
  }

  // Google OAuth Endpoints
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'الدخول عن طريق جوجل — Login via Google' })
  async googleLogin() {
    // Initiates redirect to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'استقبال الرد من جوجل — Google OAuth Callback' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async googleLoginCallback(@Req() req: any) {
    return this.authService.handleOAuth(req.user, AuthProvider.GOOGLE);
  }

  // Facebook OAuth Endpoints
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'الدخول عن طريق فيسبوك — Login via Facebook' })
  async facebookLogin() {
    // Initiates redirect to Facebook
  }

  @Post('google/token')
  @ApiOperation({ summary: 'الدخول عبر جوجل من تطبيقات الجوال — Login via Google Token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async googleTokenLogin(
    @Body('id_token') idToken?: string,
    @Body('access_token') accessToken?: string,
  ) {
    if (!idToken && !accessToken) {
      throw new BadRequestException('id_token or access_token is required');
    }
    return this.authService.verifyGoogleToken(idToken, accessToken);
  }

  @Post('facebook/token')
  @ApiOperation({ summary: 'الدخول عبر فيسبوك من تطبيقات الجوال — Login via Facebook Token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async facebookTokenLogin(@Body('access_token') accessToken: string) {
    if (!accessToken) {
      throw new BadRequestException('access_token is required');
    }
    return this.authService.verifyFacebookToken(accessToken);
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'استقبال الرد من فيسبوك — Facebook OAuth Callback' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async facebookLoginCallback(@Req() req: any) {
    return this.authService.handleOAuth(req.user, AuthProvider.FACEBOOK);
  }
}
