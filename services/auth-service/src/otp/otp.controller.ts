import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('OTP')
@Controller()
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إرسال رمز التحقق OTP للهاتف — Send verification OTP code' })
  @ApiResponse({ status: 200, description: 'تم إرسال الرمز بنجاح' })
  @ApiResponse({ status: 429, description: 'طلبات متكررة بسرعة أو الهاتف مقفل' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.otpService.sendOtp(sendOtpDto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق من رمز OTP والدخول — Verify OTP code and login' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'نجاح التحقق والدخول' })
  @ApiResponse({ status: 400, description: 'رمز التحقق غير صحيح' })
  @ApiResponse({ status: 429, description: 'الرقم مقفل بسبب محاولات خاطئة متكررة' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.otpService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.code);
  }
}
