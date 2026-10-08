import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '@/shared/events/on-domain-event.decorator';
import {
  USER_ACTIVATED_EVENT,
  UserActivatedPayload,
} from '@/modules/auth/domain/events/user-activated.event';
import { CreateDefaultAccountsUseCase } from '../create-default-accounts.use-case';

@Injectable()
export class DefaultAccountsListener {
  constructor(private readonly createDefaultAccounts: CreateDefaultAccountsUseCase) {}

  // Idempotent (only inserts missing defaults), so queue retries are safe.
  @OnDomainEvent(USER_ACTIVATED_EVENT)
  async handle(payload: UserActivatedPayload): Promise<void> {
    await this.createDefaultAccounts.execute({ userId: payload.userId });
  }
}
