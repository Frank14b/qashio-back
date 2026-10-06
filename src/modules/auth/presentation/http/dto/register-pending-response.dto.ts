import { ApiProperty } from '@nestjs/swagger';

export class RegisterPendingResponseDto {
  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({
    example: 'Registration successful. Verify your email with the OTP sent to your inbox.',
  })
  message!: string;

  @ApiProperty({ example: true })
  requiresEmailVerification!: true;
}
