import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+966500000000', description: 'رقم الهاتف لاستقبال رمز التحقق (تنسيق E.164)' })
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'رقم الهاتف يجب أن يكون بالتنسيق الدولي الصحيح (مثال: +966500000000)',
  })
  phone: string;
}
