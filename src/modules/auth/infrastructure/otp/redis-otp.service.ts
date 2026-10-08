import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';
import { OtpPurpose } from '../../domain/otp-purpose';
import { OtpPort } from '../../domain/ports/otp.port';

const FIXED_OTP = '123456';
/** Wrong guesses allowed per issued OTP before it is discarded. */
export const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class RedisOtpService implements OtpPort {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async issue(email: string, purpose: OtpPurpose): Promise<string> {
    const otp = this.generateOtp();
    const key = this.key(email, purpose);
    // A new code starts clean: drop the previous client binding and attempt count.
    await this.redis.del(this.metaKey(email, purpose));
    await this.redis.set(key, this.hash(otp), 'EX', this.ttlSeconds());
    return otp;
  }

  async bindClient(email: string, purpose: OtpPurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const metaKey = this.metaKey(email, purpose);
    // Only the hash is stored; the plaintext token goes back to the client once.
    await this.redis.hset(metaKey, 'client', this.hash(token));
    await this.redis.expire(metaKey, this.ttlSeconds());
    return token;
  }

  async verify(
    email: string,
    purpose: OtpPurpose,
    otp: string,
    clientToken?: string,
  ): Promise<boolean> {
    const key = this.key(email, purpose);
    const stored = await this.redis.get(key);
    if (!stored) {
      return false;
    }

    const metaKey = this.metaKey(email, purpose);
    const boundClient = await this.redis.hget(metaKey, 'client');
    const clientMatches =
      !boundClient || (clientToken !== undefined && this.equal(boundClient, this.hash(clientToken)));

    if (clientMatches && this.equal(stored, this.hash(otp.trim()))) {
      await this.redis.del(key);
      await this.redis.del(metaKey);
      return true;
    }

    const attempts = await this.redis.hincrby(metaKey, 'attempts', 1);
    if (attempts === 1) {
      await this.redis.expire(metaKey, this.ttlSeconds());
    }
    if (attempts >= MAX_OTP_ATTEMPTS) {
      // Too many wrong guesses: burn the code; the user must request a new one.
      await this.redis.del(key);
      await this.redis.del(metaKey);
    }
    return false;
  }

  private generateOtp(): string {
    const mode = (this.config.get<string>('EMAIL_OTP_MODE', 'fixed') ?? 'fixed').toLowerCase();
    if (mode === 'fixed') {
      return FIXED_OTP;
    }
    return String(randomInt(100000, 1000000));
  }

  private ttlSeconds(): number {
    return Number(this.config.get<string>('EMAIL_OTP_TTL_SECONDS', '600'));
  }

  private key(email: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${email.trim().toLowerCase()}`;
  }

  /** Hash with the client-token hash and the wrong-attempt counter for the current OTP. */
  private metaKey(email: string, purpose: OtpPurpose): string {
    return `otp-meta:${purpose}:${email.trim().toLowerCase()}`;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** Constant-time comparison of two hex digests. */
  private equal(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
