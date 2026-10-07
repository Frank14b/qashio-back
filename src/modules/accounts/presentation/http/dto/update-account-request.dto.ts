import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAccountRequestDto {
  @ApiPropertyOptional({ example: 'Revolut EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Set as the user’s default wallet (clears previous default)',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Soft-archive (true) or restore (false)',
  })
  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}
