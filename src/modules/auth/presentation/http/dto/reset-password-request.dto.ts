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

  @ApiProperty({ minLength: 8, example: 'NewPassword1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
