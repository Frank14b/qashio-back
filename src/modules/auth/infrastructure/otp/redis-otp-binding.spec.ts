jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

import { OtpPurpose } from '../../domain/otp-purpose';
import { MAX_OTP_ATTEMPTS, RedisOtpService } from './redis-otp.service';

/** Minimal in-memory stand-in for the ioredis commands the service uses. */
function fakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  return {
    strings,
    set: jest.fn(async (key: string, value: string) => void strings.set(key, value)),
    get: jest.fn(async (key: string) => strings.get(key) ?? null),
    del: jest.fn(async (key: string) => void (strings.delete(key), hashes.delete(key))),
    hset: jest.fn(async (key: string, field: string, value: string) => {
      hashes.set(key, (hashes.get(key) ?? new Map()).set(field, value));
    }),
    hget: jest.fn(async (key: string, field: string) => hashes.get(key)?.get(field) ?? null),
    hincrby: jest.fn(async (key: string, field: string, by: number) => {
      const hash = hashes.get(key) ?? new Map<string, string>();
      const next = Number(hash.get(field) ?? 0) + by;
      hashes.set(key, hash.set(field, String(next)));
      return next;
    }),
    expire: jest.fn(async () => 1),
  };
}

describe('RedisOtpService client binding and attempt cap', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'EMAIL_OTP_MODE' ? 'fixed' : (fallback ?? ''),
    ),
  };
  const email = 'jane@example.com';
  const purpose = OtpPurpose.PASSWORD_RESET;
  let redis: ReturnType<typeof fakeRedis>;
  let service: RedisOtpService;

  beforeEach(() => {
    redis = fakeRedis();
    service = new RedisOtpService(redis as never, config as never);
  });

  it('only accepts a bound OTP together with the token issued to that client', async () => {
    const otp = await service.issue(email, purpose);
    const token = await service.bindClient(email, purpose);

    await expect(service.verify(email, purpose, otp)).resolves.toBe(false);
    await expect(service.verify(email, purpose, otp, 'someone-elses-token')).resolves.toBe(false);
    await expect(service.verify(email, purpose, otp, token)).resolves.toBe(true);
    // Single use.
    await expect(service.verify(email, purpose, otp, token)).resolves.toBe(false);
  });

  it('stores only a hash of the client token', async () => {
    await service.issue(email, purpose);
    const token = await service.bindClient(email, purpose);

    const storedValues = redis.hset.mock.calls.map(([, , value]) => value);
    expect(storedValues).not.toContain(token);
  });

  it(`burns the OTP after ${MAX_OTP_ATTEMPTS} wrong attempts, even if the right code follows`, async () => {
    const otp = await service.issue(email, purpose);
    const token = await service.bindClient(email, purpose);

    for (let i = 0; i < MAX_OTP_ATTEMPTS; i += 1) {
      await expect(service.verify(email, purpose, '000000', token)).resolves.toBe(false);
    }
    await expect(service.verify(email, purpose, otp, token)).resolves.toBe(false);
  });

  it('a new OTP resets the binding: the old token no longer works', async () => {
    await service.issue(email, purpose);
    const oldToken = await service.bindClient(email, purpose);
    const otp = await service.issue(email, purpose);
    const newToken = await service.bindClient(email, purpose);

    await expect(service.verify(email, purpose, otp, oldToken)).resolves.toBe(false);
    await expect(service.verify(email, purpose, otp, newToken)).resolves.toBe(true);
  });
});
