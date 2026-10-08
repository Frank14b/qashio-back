import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;
}
