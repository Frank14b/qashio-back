import { DiscoveryService } from '@nestjs/core';

/** Second argument of every handler. */
export type DomainEventContext = {
  /** Outbox id of the event: stable across retries and re-relays, so handlers can deduplicate. */
  eventId: string;
};

/**
 * Marks a provider method as a handler of a domain event, e.g.
 * `@OnDomainEvent(TRANSACTION_CREATED_EVENT)`. Each handler runs as its own
 * queued job, so it is retried on failure without re-running other handlers
 * of the same event. Handlers must therefore throw on failure (never swallow
 * errors) and be safe to run more than once (use `context.eventId`).
 */
export const OnDomainEvent = DiscoveryService.createDecorator<string>();
