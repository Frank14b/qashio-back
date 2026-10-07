import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  USER_ACTIVATED_EVENT,
  UserActivatedPayload,
} from '@/modules/auth/domain/events/user-activated.event';
import { CreateDefaultCategoriesUseCase } from '../create-default-categories.use-case';

@Injectable()
export class UserActivatedListener {
  private readonly logger = new Logger(UserActivatedListener.name);

  constructor(
    private readonly createDefaultCategories: CreateDefaultCategoriesUseCase,
  ) {}

  @OnEvent(USER_ACTIVATED_EVENT, { async: true })
  async handle(payload: UserActivatedPayload): Promise<void> {
    try {
      await this.createDefaultCategories.execute({ userId: payload.userId });
    } catch (error) {
      this.logger.error(
        `Failed to create default categories for user ${payload.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
