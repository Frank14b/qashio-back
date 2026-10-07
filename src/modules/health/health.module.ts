import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisHealthIndicator } from './infrastructure/redis.health-indicator';
import { HealthController } from './presentation/http/health.controller';

/** Operational probes only — no domain, so no domain/application layers. */
@Module({
  imports: [TerminusModule.forRoot({ errorLogStyle: 'pretty' })],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
