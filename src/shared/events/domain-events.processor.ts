import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { DomainEventHandlersRegistry } from './domain-event-handlers.registry';
import { DOMAIN_EVENTS_QUEUE, DomainEventJobData } from './domain-events.queue';

/** Runs one handler per job; a thrown error makes BullMQ retry it with backoff. */
@Processor(DOMAIN_EVENTS_QUEUE, { concurrency: 5 })
export class DomainEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventsProcessor.name);

  constructor(private readonly handlers: DomainEventHandlersRegistry) {
    super();
  }

  async process(job: Job<DomainEventJobData>): Promise<void> {
    const handler = this.handlers.get(job.data.handler);
    if (!handler) {
      // Handler renamed or removed since the job was queued: retrying cannot help.
      throw new UnrecoverableError(`No domain event handler "${job.data.handler}"`);
    }
    await handler.invoke(job.data.payload, { eventId: job.data.eventId });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DomainEventJobData> | undefined, error: Error): void {
    if (!job) {
      return;
    }
    const context = {
      jobId: job.id,
      event: job.data.event,
      handler: job.data.handler,
      attempt: job.attemptsMade,
    };
    const exhausted =
      error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      // Error level: reported to Sentry. The job stays in the failed set for inspection.
      this.logger.error({ ...context, err: error }, `Domain event handler gave up`);
    } else {
      this.logger.warn({ ...context, reason: error.message }, `Domain event handler failed; will retry`);
    }
  }
}
