import { InjectTransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TypeOrmTransactionHost } from '@/shared/database/transaction-host';
import { DomainEventPublisherPort, EmitOptions } from '../domain-event-publisher.port';
import { OutboxEventOrmEntity } from './outbox-event.orm-entity';

/** Writes events to `outbox_events` through the caller's transaction (if any). */
@Injectable()
export class OutboxDomainEventPublisher implements DomainEventPublisherPort {
  constructor(@InjectTransactionHost() private readonly txHost: TypeOrmTransactionHost) {}

  async emit(event: string, payload: unknown, options: EmitOptions = {}): Promise<void> {
    await this.txHost.tx
      .createQueryBuilder()
      .insert()
      .into(OutboxEventOrmEntity)
      .values({
        id: randomUUID(),
        event,
        payload: payload as object,
        dedupeKey: options.dedupeKey ?? null,
      })
      // A dedupe key seen before means this event is already recorded.
      .orIgnore()
      .execute();
  }
}
