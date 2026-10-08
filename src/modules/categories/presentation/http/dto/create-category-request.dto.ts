import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '@/shared/validation/trim.transform';
import { CategoryKind } from '../../../domain/category-kind';

export class CreateCategoryRequestDto {
  @ApiProperty({ example: 'Groceries' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: CategoryKind,
    example: CategoryKind.EXPENSE,
    description: 'income | expense | both',
  })
  @IsEnum(CategoryKind)
  kind!: CategoryKind;
}
