export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

export type EmitOptions = {
  /**
   * Records the event at most once per key, for emitters that can run more
   * than once for the same cause (e.g. a retried event handler).
   */
  dedupeKey?: string;
};

export interface DomainEventPublisherPort {
  /**
   * Records the event in the outbox. Call it inside the same UnitOfWork as the
   * write that raised it, so the event commits (or rolls back) with that write.
   */
  emit(event: string, payload: unknown, options?: EmitOptions): Promise<void>;
}
