import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  displayName!: string;
}

export class AuthTokensResponseDto {
  @ApiProperty({
    description: 'JWT access token for Authorization: Bearer',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Opaque refresh token for /auth/refresh and /auth/logout',
    example: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4tZXhhbXBsZQ',
  })
  refreshToken!: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
