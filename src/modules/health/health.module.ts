import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisHealthIndicator } from './infrastructure/redis.health-indicator';
import { HealthController } from './presentation/http/health.controller';

/** Operational probes only — no domain, so no domain/application layers. */
@Module({
  // Failures are already visible as 503 bodies and a warn line from the exception
  // filter; Terminus' own error-level log would page Sentry for expected outages.
  imports: [TerminusModule.forRoot({ logger: false })],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
