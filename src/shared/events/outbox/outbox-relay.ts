import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { setTimeout as sleep } from 'node:timers/promises';
import { DataSource, In, IsNull, LessThan, Not } from 'typeorm';
import { DomainEventHandlersRegistry } from '../domain-event-handlers.registry';
import { DOMAIN_EVENTS_QUEUE, DomainEventJobData } from '../domain-events.queue';
import { OutboxEventOrmEntity } from './outbox-event.orm-entity';
import { toHandlerJobs } from './outbox-jobs';

export const OUTBOX_POLL_INTERVAL_MS = 1000;
export const OUTBOX_BATCH_SIZE = 100;
/**
 * BullMQ waits for Redis indefinitely; cap it so a pass never holds the row
 * locks for long. A late success is harmless: job ids are deterministic.
 */
const ENQUEUE_TIMEOUT_MS = 10_000;
/** Published rows are kept this long for inspection, then deleted. */
export const OUTBOX_RETENTION_MS = 7 * 24 * 3600 * 1000;
const CLEANUP_INTERVAL_MS = 3600 * 1000;

/**
 * Moves committed outbox rows to the domain-events queue. Each pass locks a
 * batch with FOR UPDATE SKIP LOCKED (several API instances never take the same
 * rows), enqueues it and marks it published in the same DB transaction: if
 * Redis refuses the jobs the rows stay pending and the next pass retries.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private lastCleanupAt = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly queue: Queue<DomainEventJobData>,
    private readonly handlers: DomainEventHandlersRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), OUTBOX_POLL_INTERVAL_MS);
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** Relays until no pending rows are left (one batch per transaction). */
  async relayPending(): Promise<void> {
    while ((await this.relayBatch()) === OUTBOX_BATCH_SIZE) {
      // Full batch: there may be more.
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = (async () => {
      try {
        await this.relayPending();
        await this.cleanupPublished();
      } catch (error) {
        // Rows stay pending; the next tick retries. Warn, not error: a Redis
        // outage would otherwise report every second.
        this.logger.warn({ reason: (error as Error).message }, 'Outbox relay pass failed');
      } finally {
        this.running = undefined;
      }
    })();
    await this.running;
  }

  private relayBatch(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .createQueryBuilder(OutboxEventOrmEntity, 'o')
        .where('o.published_at IS NULL')
        .orderBy('o.created_at', 'ASC')
        .limit(OUTBOX_BATCH_SIZE)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
      if (rows.length === 0) {
        return 0;
      }
      const jobs = toHandlerJobs(rows, this.handlers);
      if (jobs.length > 0) {
        await Promise.race([
          this.queue.addBulk(jobs),
          sleep(ENQUEUE_TIMEOUT_MS, undefined, { ref: false }).then(() => {
            throw new Error(`Enqueue timed out after ${ENQUEUE_TIMEOUT_MS} ms`);
          }),
        ]);
      }
      await manager.update(
        OutboxEventOrmEntity,
        { id: In(rows.map((row) => row.id)) },
        { publishedAt: new Date() },
      );
      return rows.length;
    });
  }

  private async cleanupPublished(): Promise<void> {
    if (Date.now() - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }
    this.lastCleanupAt = Date.now();
    await this.dataSource.getRepository(OutboxEventOrmEntity).delete({
      publishedAt: Not(IsNull()),
      createdAt: LessThan(new Date(Date.now() - OUTBOX_RETENTION_MS)),
    });
  }
}
