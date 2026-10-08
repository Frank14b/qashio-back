import { ApiProperty } from '@nestjs/swagger';
import { CategoryKind } from '../../../domain/category-kind';

export class CategoryResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'Food' })
  name!: string;

  @ApiProperty({ enum: CategoryKind, example: CategoryKind.EXPENSE })
  kind!: CategoryKind;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
