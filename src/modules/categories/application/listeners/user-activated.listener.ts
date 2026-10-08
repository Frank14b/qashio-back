import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '@/shared/events/on-domain-event.decorator';
import {
  USER_ACTIVATED_EVENT,
  UserActivatedPayload,
} from '@/modules/auth/domain/events/user-activated.event';
import { CreateDefaultCategoriesUseCase } from '../create-default-categories.use-case';

@Injectable()
export class DefaultCategoriesListener {
  constructor(
    private readonly createDefaultCategories: CreateDefaultCategoriesUseCase,
  ) {}

  // Idempotent (only inserts missing defaults), so queue retries are safe.
  @OnDomainEvent(USER_ACTIVATED_EVENT)
  async handle(payload: UserActivatedPayload): Promise<void> {
    await this.createDefaultCategories.execute({ userId: payload.userId });
  }
}
