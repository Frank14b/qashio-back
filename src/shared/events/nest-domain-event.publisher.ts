import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventPublisherPort } from './domain-event-publisher.port';

@Injectable()
export class NestDomainEventPublisher implements DomainEventPublisherPort {
  constructor(private readonly events: EventEmitter2) {}

  emit(event: string, payload: unknown): void {
    this.events.emit(event, payload);
  }
}
