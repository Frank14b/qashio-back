import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AccessTokenUser,
  CurrentUser,
} from '@/modules/auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard';
import { ErrorResponseDto } from '@/shared/http/error-response.dto';
import { GetNotificationsUseCase } from '../../application/get-notifications.use-case';
import { MarkNotificationsReadUseCase } from '../../application/mark-notifications-read.use-case';
import {
  ListNotificationsQueryDto,
  NotificationListResponseDto,
} from './dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly getNotifications: GetNotificationsUseCase,
    private readonly markRead: MarkNotificationsReadUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Recent notifications (newest first) and the unread count' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  async list(
    @CurrentUser() user: AccessTokenUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    const { items, unreadCount } = await this.getNotifications.execute({
      userId: user.sub,
      limit: query.limit ?? 20,
      unreadOnly: query.unreadOnly ?? false,
    });
    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark every notification as read' })
  @ApiNoContentResponse()
  async readAll(@CurrentUser() user: AccessTokenUser): Promise<void> {
    await this.markRead.execute(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read (idempotent)' })
  @ApiNoContentResponse()
  async readOne(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.markRead.execute(user.sub, id);
  }
}
