import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { OnDomainEvent } from './on-domain-event.decorator';

type DomainEventHandler = {
  /** Stable id stored in the job, e.g. `TransactionEventsListener.onCreated`. */
  id: string;
  event: string;
  invoke: (payload: unknown) => Promise<unknown>;
};

/** Every `@OnDomainEvent` method in the app, found once at startup. */
@Injectable()
export class DomainEventHandlersRegistry implements OnModuleInit {
  private readonly byId = new Map<string, DomainEventHandler>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!instance || typeof instance !== 'object' || !wrapper.isDependencyTreeStatic()) {
        continue;
      }
      const prototype = Object.getPrototypeOf(instance) as object;
      for (const method of this.scanner.getAllMethodNames(prototype)) {
        const event = this.discovery.getMetadataByDecorator(OnDomainEvent, wrapper, method);
        if (!event) {
          continue;
        }
        const id = `${instance.constructor.name}.${method}`;
        if (this.byId.has(id)) {
          throw new Error(`Duplicate domain event handler id: ${id}`);
        }
        const handler = (instance as Record<string, (payload: unknown) => unknown>)[method];
        this.byId.set(id, {
          id,
          event,
          invoke: async (payload) => handler.call(instance, payload),
        });
      }
    }
  }

  handlersFor(event: string): DomainEventHandler[] {
    return [...this.byId.values()].filter((handler) => handler.event === event);
  }

  get(id: string): DomainEventHandler | undefined {
    return this.byId.get(id);
  }
}
