import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'البريد الإلكتروني للمستخدم' })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @ApiPropertyOptional({ example: '+966500000000', description: 'رقم الهاتف للمستخدم' })
  @IsOptional()
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رقم الهاتف لا يمكن أن يكون فارغًا' })
  phone?: string;

  @ApiProperty({ example: 'احمد محمد', description: 'الاسم الكامل للمستخدم' })
  @IsString({ message: 'الاسم الكامل يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'الاسم الكامل مطلوب' })
  fullName: string;

  @ApiProperty({ example: 'password123', description: 'كلمة المرور' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصًا' })
  @MinLength(6, { message: 'كلمة المرور يجب أن لا تقل عن 6 أحرف' })
  password: string;
}
