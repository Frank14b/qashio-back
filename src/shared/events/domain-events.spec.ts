import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { BullMqDomainEventPublisher } from './bullmq-domain-event.publisher';
import { DomainEventHandlersRegistry } from './domain-event-handlers.registry';
import { DOMAIN_EVENT_JOB_OPTIONS, DomainEventJobData } from './domain-events.queue';
import { DomainEventsProcessor } from './domain-events.processor';
import { OnDomainEvent } from './on-domain-event.decorator';

@Injectable()
class BudgetsHandler {
  calls: unknown[] = [];

  @OnDomainEvent('transaction.created')
  async onCreated(payload: unknown) {
    this.calls.push(payload);
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
  let queue: { addBulk: jest.Mock };
  let publisher: BullMqDomainEventPublisher;
  let processor: DomainEventsProcessor;

  const jobFor = (handler: string): Job<DomainEventJobData> =>
    ({ data: { event: 'transaction.created', handler, payload: { id: 'txn-1' } } }) as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [DomainEventHandlersRegistry, BudgetsHandler, NotificationsHandler],
    }).compile();
    await moduleRef.init();

    registry = moduleRef.get(DomainEventHandlersRegistry);
    budgets = moduleRef.get(BudgetsHandler);
    queue = { addBulk: jest.fn().mockResolvedValue([]) };
    publisher = new BullMqDomainEventPublisher(queue as never, registry);
    processor = new DomainEventsProcessor(registry);
  });

  it('retries each handler job up to 5 times with backoff', () => {
    expect(DOMAIN_EVENT_JOB_OPTIONS).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential' },
    });
  });

  it('enqueues one job per handler so each one is retried on its own', () => {
    publisher.emit('transaction.created', { id: 'txn-1' });
    publisher.emit('nobody.listens', {});

    expect(queue.addBulk).toHaveBeenCalledTimes(1);
    expect(queue.addBulk).toHaveBeenCalledWith([
      {
        name: 'transaction.created',
        data: {
          event: 'transaction.created',
          handler: 'BudgetsHandler.onCreated',
          payload: { id: 'txn-1' },
        },
      },
      {
        name: 'transaction.created',
        data: {
          event: 'transaction.created',
          handler: 'NotificationsHandler.onCreated',
          payload: { id: 'txn-1' },
        },
      },
    ]);
  });

  it('runs only the job’s handler and lets its error through so BullMQ retries it', async () => {
    await processor.process(jobFor('BudgetsHandler.onCreated'));
    expect(budgets.calls).toEqual([{ id: 'txn-1' }]);

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
