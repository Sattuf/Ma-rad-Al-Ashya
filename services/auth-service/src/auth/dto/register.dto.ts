import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'البريد الإلكتروني للمستخدم' })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @ApiPropertyOptional({ example: '+966500000000', description: 'رقم الهاتف للمستخدم' })
  @IsOptional()
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رقم الهاتف لا يمكن أن يكون فارغًا' })
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'رقم الهاتف يجب أن يكون بالتنسيق الدولي الصحيح (مثال: +966500000000)' })
  phone?: string;

  @ApiProperty({ example: 'احمد محمد', description: 'الاسم الكامل للمستخدم' })
  @IsString({ message: 'الاسم الكامل يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'الاسم الكامل مطلوب' })
  @MaxLength(100, { message: 'الاسم الكامل يجب أن لا يزيد عن 100 حرف' })
  fullName: string;

  @ApiProperty({ example: 'password123', description: 'كلمة المرور' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصًا' })
  @MinLength(8, { message: 'كلمة المرور يجب أن لا تقل عن 8 أحرف' })
  @MaxLength(72, { message: 'كلمة المرور يجب أن لا تزيد عن 72 حرفاً' })
  password: string;

  @ApiPropertyOptional({ example: 'abc123xyz', description: 'بصمة الجهاز' })
  @IsOptional()
  @IsString()
  fingerprint_hash?: string;
}
