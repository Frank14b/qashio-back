import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 'If an account exists for that email, a password reset OTP has been sent.' })
  message!: string;
}
