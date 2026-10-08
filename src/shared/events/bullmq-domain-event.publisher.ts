import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DomainEventHandlersRegistry } from './domain-event-handlers.registry';
import { DomainEventPublisherPort } from './domain-event-publisher.port';
import { DOMAIN_EVENTS_QUEUE, DomainEventJobData } from './domain-events.queue';

/**
 * Persists each event as one Redis job per handler. Jobs survive an API
 * restart and are retried independently (see DOMAIN_EVENT_JOB_OPTIONS), so a
 * failing notification never re-runs the budget check for the same event.
 */
@Injectable()
export class BullMqDomainEventPublisher implements DomainEventPublisherPort {
  private readonly logger = new Logger(BullMqDomainEventPublisher.name);

  constructor(
    @InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly queue: Queue<DomainEventJobData>,
    private readonly handlers: DomainEventHandlersRegistry,
  ) {}

  emit(event: string, payload: unknown): void {
    const jobs = this.handlers.handlersFor(event).map((handler) => ({
      name: event,
      data: { event, handler: handler.id, payload },
    }));
    if (jobs.length === 0) {
      return;
    }
    // The write that raised the event is already committed: enqueue without
    // blocking the request; a failure here is logged (and reported to Sentry).
    this.queue.addBulk(jobs).catch((error: unknown) => {
      this.logger.error(
        { err: error, event, handlers: jobs.map((job) => job.data.handler) },
        `Failed to enqueue domain event ${event}`,
      );
    });
  }
}
