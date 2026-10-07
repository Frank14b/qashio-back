export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

export interface DomainEventPublisherPort {
  emit(event: string, payload: unknown): void;
}
