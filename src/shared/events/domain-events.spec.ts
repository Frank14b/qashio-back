import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { DomainEventHandlersRegistry } from './domain-event-handlers.registry';
import { DOMAIN_EVENT_JOB_OPTIONS, DomainEventJobData } from './domain-events.queue';
import { DomainEventsProcessor } from './domain-events.processor';
import { DomainEventContext, OnDomainEvent } from './on-domain-event.decorator';
import { toHandlerJobs } from './outbox/outbox-jobs';

@Injectable()
class BudgetsHandler {
  calls: [unknown, DomainEventContext][] = [];

  @OnDomainEvent('transaction.created')
  async onCreated(payload: unknown, context: DomainEventContext) {
    this.calls.push([payload, context]);
  }
}

@Injectable()
class NotificationsHandler {
  @OnDomainEvent('transaction.created')
  async onCreated() {
    throw new Error('SMTP down');
  }
}

describe('Domain events queue', () => {
  let registry: DomainEventHandlersRegistry;
  let budgets: BudgetsHandler;
  let processor: DomainEventsProcessor;

  const jobFor = (handler: string): Job<DomainEventJobData> =>
    ({
      data: { eventId: 'evt-1', event: 'transaction.created', handler, payload: { id: 'txn-1' } },
    }) as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [DomainEventHandlersRegistry, BudgetsHandler, NotificationsHandler],
    }).compile();
    await moduleRef.init();

    registry = moduleRef.get(DomainEventHandlersRegistry);
    budgets = moduleRef.get(BudgetsHandler);
    processor = new DomainEventsProcessor(registry);
  });

  it('retries each handler job up to 5 times with backoff', () => {
    expect(DOMAIN_EVENT_JOB_OPTIONS).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential' },
    });
  });

  it('turns each outbox row into one job per handler, with ids stable across re-relays', () => {
    const rows = [
      { id: 'evt-1', event: 'transaction.created', payload: { id: 'txn-1' } },
      { id: 'evt-2', event: 'nobody.listens', payload: {} },
    ];

    const jobs = toHandlerJobs(rows, registry);

    expect(jobs).toEqual([
      {
        name: 'transaction.created',
        data: {
          eventId: 'evt-1',
          event: 'transaction.created',
          handler: 'BudgetsHandler.onCreated',
          payload: { id: 'txn-1' },
        },
        opts: { jobId: 'evt-1.BudgetsHandler.onCreated' },
      },
      {
        name: 'transaction.created',
        data: {
          eventId: 'evt-1',
          event: 'transaction.created',
          handler: 'NotificationsHandler.onCreated',
          payload: { id: 'txn-1' },
        },
        opts: { jobId: 'evt-1.NotificationsHandler.onCreated' },
      },
    ]);
    // Relaying the same row again yields the same job ids, which BullMQ ignores.
    expect(toHandlerJobs(rows, registry).map((job) => job.opts.jobId)).toEqual(
      jobs.map((job) => job.opts.jobId),
    );
  });

  it('runs only the job’s handler and lets its error through so BullMQ retries it', async () => {
    await processor.process(jobFor('BudgetsHandler.onCreated'));
    expect(budgets.calls).toEqual([[{ id: 'txn-1' }, { eventId: 'evt-1' }]]);

    await expect(processor.process(jobFor('NotificationsHandler.onCreated'))).rejects.toThrow(
      'SMTP down',
    );
    expect(budgets.calls).toHaveLength(1);
  });

  it('does not retry a job whose handler no longer exists', async () => {
    await expect(processor.process(jobFor('Removed.handler'))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
