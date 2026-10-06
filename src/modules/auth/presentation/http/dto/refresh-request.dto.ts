import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token issued by register, login, or refresh',
    minLength: 20,
    example: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4tZXhhbXBsZQ',
  })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
