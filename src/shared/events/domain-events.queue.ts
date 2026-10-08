import type { DefaultJobOptions } from 'bullmq';

export const DOMAIN_EVENTS_QUEUE = 'domain-events';

/** One job per (event, handler); `name` is the event so queue tooling shows it. */
export type DomainEventJobData = {
  /** outbox_events.id: same for every handler of one event and across re-relays. */
  eventId: string;
  event: string;
  /** DomainEventHandlersRegistry id of the handler this job runs. */
  handler: string;
  payload: unknown;
};

/**
 * Deterministic, so relaying the same outbox row twice (crash after enqueue,
 * before marking it published) is a no-op: BullMQ ignores a job id it already
 * holds. Job ids must not contain ':'.
 */
export const domainEventJobId = (eventId: string, handler: string): string =>
  `${eventId}.${handler}`;

/** Total tries per handler job (first run + 4 retries). */
export const DOMAIN_EVENT_JOB_ATTEMPTS = 5;

export const DOMAIN_EVENT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: DOMAIN_EVENT_JOB_ATTEMPTS,
  // Retries after ~2s, 4s, 8s, 16s: rides out a DB restart or a Redis blip.
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  // Exhausted jobs stay in Redis for a week so they can be inspected and retried.
  removeOnFail: { age: 7 * 24 * 3600 },
};
