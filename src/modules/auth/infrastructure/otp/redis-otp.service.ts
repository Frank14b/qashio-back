import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';
import { OtpPurpose } from '../../domain/otp-purpose';
import { OtpPort } from '../../domain/ports/otp.port';

const FIXED_OTP = '123456';

@Injectable()
export class RedisOtpService implements OtpPort {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async issue(email: string, purpose: OtpPurpose): Promise<string> {
    const otp = this.generateOtp();
    const key = this.key(email, purpose);
    const ttlSeconds = Number(this.config.get<string>('EMAIL_OTP_TTL_SECONDS', '600'));
    await this.redis.set(key, this.hash(otp), 'EX', ttlSeconds);
    return otp;
  }

  async verify(email: string, purpose: OtpPurpose, otp: string): Promise<boolean> {
    const key = this.key(email, purpose);
    const stored = await this.redis.get(key);
    if (!stored) {
      return false;
    }

    const matches = stored === this.hash(otp.trim());
    if (matches) {
      await this.redis.del(key);
    }
    return matches;
  }

  private generateOtp(): string {
    const mode = (this.config.get<string>('EMAIL_OTP_MODE', 'fixed') ?? 'fixed').toLowerCase();
    if (mode === 'fixed') {
      return FIXED_OTP;
    }
    return String(randomInt(100000, 1000000));
  }

  private key(email: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${email.trim().toLowerCase()}`;
  }

  private hash(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }
}
