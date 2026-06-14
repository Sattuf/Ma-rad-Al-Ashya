import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh_token_here', description: 'رمز التحديث (Refresh Token)' })
  @IsString({ message: 'رمز التحديث يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  refresh_token: string;
}
