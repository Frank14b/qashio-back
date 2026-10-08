import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationType } from '../../../domain/notification-type';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unreadOnly?: boolean;
}

class NotificationDataDto {
  @ApiPropertyOptional({ format: 'uuid' })
  transactionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  budgetId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  accountId?: string;
}

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ example: 'Budget at 80%: Food' })
  title!: string;

  @ApiProperty({ example: "You've spent USD 412.30 of your USD 500.00 Food budget this month." })
  message!: string;

  @ApiProperty({ type: NotificationDataDto, description: 'Ids to link to the related resource' })
  data!: NotificationDataDto;

  @ApiProperty({ nullable: true, type: String })
  readAt!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: NotificationResponseDto, isArray: true })
  items!: NotificationResponseDto[];

  @ApiProperty({ example: 3 })
  unreadCount!: number;
}
