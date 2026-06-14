import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'البريد الإلكتروني أو رقم الهاتف للمستخدم' })
  @IsString({ message: 'المعرّف يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'المعرّف (البريد الإلكتروني أو الهاتف) مطلوب' })
  identifier: string;

  @ApiProperty({ example: 'password123', description: 'كلمة المرور' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصًا' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  password: string;
}
