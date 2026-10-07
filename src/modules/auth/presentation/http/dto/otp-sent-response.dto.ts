import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

export class OtpSentResponseDto extends MessageResponseDto {
  @ApiProperty({
    description:
      'Send back with the OTP to confirm. Only the client holding it can use the code.',
    example: 'k3Jq0n4bX8m2...',
  })
  otpToken!: string;
}
