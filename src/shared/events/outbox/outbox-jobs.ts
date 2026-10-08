import type { DomainEventHandlersRegistry } from '../domain-event-handlers.registry';
import { DomainEventJobData, domainEventJobId } from '../domain-events.queue';
import type { OutboxEventOrmEntity } from './outbox-event.orm-entity';

type HandlerJob = { name: string; data: DomainEventJobData; opts: { jobId: string } };

/** One BullMQ job per (outbox row, handler); rows without handlers yield none. */
export function toHandlerJobs(
  rows: Pick<OutboxEventOrmEntity, 'id' | 'event' | 'payload'>[],
  handlers: Pick<DomainEventHandlersRegistry, 'handlersFor'>,
): HandlerJob[] {
  return rows.flatMap((row) =>
    handlers.handlersFor(row.event).map((handler) => ({
      name: row.event,
      data: { eventId: row.id, event: row.event, handler: handler.id, payload: row.payload },
      opts: { jobId: domainEventJobId(row.id, handler.id) },
    })),
  );
}
