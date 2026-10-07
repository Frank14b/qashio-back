import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';

/** Terminus ships no Redis indicator; this wraps a PING in its `attempt` helper. */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  pingCheck<const Key extends string>(key: Key, timeoutMs: number) {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.redis.ping();
      })
      .withTimeout(timeoutMs);
  }
}
