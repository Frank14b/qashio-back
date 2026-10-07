import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateAccountRequestDto {
  @ApiProperty({ example: 'Cash' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  currencyCode!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'At most one default per user; first wallet becomes default if omitted',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
