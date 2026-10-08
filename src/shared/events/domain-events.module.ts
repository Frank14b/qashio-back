import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import Redis from 'ioredis';
import { BullMqDomainEventPublisher } from './bullmq-domain-event.publisher';
import { DomainEventHandlersRegistry } from './domain-event-handlers.registry';
import { DOMAIN_EVENT_PUBLISHER } from './domain-event-publisher.port';
import { DomainEventsProcessor } from './domain-events.processor';
import { DOMAIN_EVENT_JOB_OPTIONS, DOMAIN_EVENTS_QUEUE } from './domain-events.queue';

/**
 * Domain events go through a BullMQ queue in Redis: `@OnDomainEvent` handlers
 * run in a worker (in this process), each as its own job with retries.
 */
@Global()
@Module({
  imports: [
    DiscoveryModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // BullMQ workers block on Redis and must not give up on a command: maxRetriesPerRequest null.
        const url = config.get<string>('REDIS_URL');
        return {
          connection: url
            ? new Redis(url, { maxRetriesPerRequest: null })
            : {
                host: config.get<string>('REDIS_HOST'),
                port: config.get<number>('REDIS_PORT'),
                password: config.get<string>('REDIS_PASSWORD'),
                maxRetriesPerRequest: null,
              },
        };
      },
    }),
    BullModule.registerQueue({
      name: DOMAIN_EVENTS_QUEUE,
      defaultJobOptions: DOMAIN_EVENT_JOB_OPTIONS,
    }),
  ],
  providers: [
    DomainEventHandlersRegistry,
    DomainEventsProcessor,
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: BullMqDomainEventPublisher,
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}
