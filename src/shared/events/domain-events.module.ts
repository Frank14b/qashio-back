import { Global, Module } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
} from './domain-event-publisher.port';
import { NestDomainEventPublisher } from './nest-domain-event.publisher';

@Global()
@Module({
  providers: [
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: NestDomainEventPublisher,
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}
