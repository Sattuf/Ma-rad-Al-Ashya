import { ApiProperty } from '@nestjs/swagger';

class UserResponse {
  @ApiProperty({ example: 'd0e74653-f726-4d7a-b9c1-54a8cf6fb00a' })
  id: string;

  @ApiProperty({ example: '+966500000000', required: false })
  phone?: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  email?: string;

  @ApiProperty({ example: 'احمد محمد' })
  fullName: string;

  @ApiProperty({ example: 'user' })
  role: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: 'local' })
  authProvider: string;
}

class TokensResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponse })
  user: UserResponse;

  @ApiProperty({ type: TokensResponse })
  tokens: TokensResponse;
}
