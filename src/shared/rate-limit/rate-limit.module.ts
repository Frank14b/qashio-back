import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { RedisModule } from '../redis/redis.module';

const MINUTE_MS = 60_000;

/**
 * Per-route overrides for endpoints worth brute-forcing (credentials, OTPs).
 * Use with `@Throttle(STRICT_AUTH_THROTTLE)`. Keyed by client IP; OTP codes are
 * additionally capped per email in RedisOtpService.
 */
export const STRICT_AUTH_THROTTLE = { default: { limit: 5, ttl: MINUTE_MS } };
/** Refresh is called automatically by clients, so it gets more headroom. */
export const REFRESH_THROTTLE = { default: { limit: 30, ttl: MINUTE_MS } };

/**
 * Global rate limit (RATE_LIMIT_PER_MINUTE, default 120) on every route.
 * Counters live in Redis so limits hold across API instances.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: MINUTE_MS,
            limit: Number(config.get<string>('RATE_LIMIT_PER_MINUTE', '120')),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
        errorMessage: 'Too many requests. Please wait a moment and try again.',
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
