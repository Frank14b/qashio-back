import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  otp!: string;

  @ApiProperty({
    description: 'otpToken returned by POST /auth/forgot-password for this request',
    example: 'k3Jq0n4bX8m2...',
  })
  @IsString()
  @Length(43, 43)
  otpToken!: string;

  @ApiProperty({ minLength: 8, example: 'NewPassword1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
