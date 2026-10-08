import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DomainEventHandlersRegistry } from './domain-event-handlers.registry';
import { DOMAIN_EVENT_PUBLISHER } from './domain-event-publisher.port';
import { DomainEventsProcessor } from './domain-events.processor';
import { DOMAIN_EVENT_JOB_OPTIONS, DOMAIN_EVENTS_QUEUE } from './domain-events.queue';
import { OutboxDomainEventPublisher } from './outbox/outbox-domain-event.publisher';
import { OutboxEventOrmEntity } from './outbox/outbox-event.orm-entity';
import { OutboxRelay } from './outbox/outbox-relay';

/**
 * Domain events: use cases write them to the outbox table in their own DB
 * transaction; OutboxRelay moves committed rows to the BullMQ queue; the
 * worker runs each `@OnDomainEvent` handler as its own job with retries.
 */
@Global()
@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([OutboxEventOrmEntity]),
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
    OutboxRelay,
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: OutboxDomainEventPublisher,
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}
