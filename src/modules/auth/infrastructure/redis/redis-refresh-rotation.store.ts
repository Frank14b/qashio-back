import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';
import { RefreshRotationStorePort } from '../../domain/ports/refresh-rotation.port';

@Injectable()
export class RedisRefreshRotationStore implements RefreshRotationStorePort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async tryLock(tokenHash: string, ttlMs: number): Promise<boolean> {
    // SET NX PX: atomic "claim if free" with expiry, so a crashed holder cannot block forever.
    const result = await this.redis.set(this.lockKey(tokenHash), '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async release(tokenHash: string): Promise<void> {
    await this.redis.del(this.lockKey(tokenHash));
  }

  async getResult<T>(tokenHash: string): Promise<T | null> {
    const raw = await this.redis.get(this.resultKey(tokenHash));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async saveResult<T>(tokenHash: string, result: T, ttlMs: number): Promise<void> {
    await this.redis.set(this.resultKey(tokenHash), JSON.stringify(result), 'PX', ttlMs);
  }

  private lockKey(tokenHash: string): string {
    return `refresh:lock:${tokenHash}`;
  }

  private resultKey(tokenHash: string): string {
    return `refresh:result:${tokenHash}`;
  }
}
