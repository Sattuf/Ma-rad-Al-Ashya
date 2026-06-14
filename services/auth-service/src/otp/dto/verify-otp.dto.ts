import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+966500000000', description: 'رقم الهاتف الذي تم إرسال الرمز إليه' })
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'رقم الهاتف يجب أن يكون بالتنسيق الدولي الصحيح (مثال: +966500000000)',
  })
  phone: string;

  @ApiProperty({ example: '123456', description: 'رمز التحقق المكون من 4 أو 6 أرقام' })
  @IsString({ message: 'رمز التحقق يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @Length(4, 6, { message: 'رمز التحقق يجب أن يتراوح طوله بين 4 و 6 أرقام' })
  code: string;
}
