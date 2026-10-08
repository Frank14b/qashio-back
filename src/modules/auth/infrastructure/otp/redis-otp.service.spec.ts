jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

import { createHash } from 'crypto';
import { OtpPurpose } from '../../domain/otp-purpose';
import { RedisOtpService } from './redis-otp.service';

describe('RedisOtpService', () => {
  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hincrby: jest.fn(),
    expire: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string): string => {
      const values: Record<string, string> = {
        EMAIL_OTP_MODE: 'fixed',
        EMAIL_OTP_TTL_SECONDS: '600',
      };
      return values[key] ?? fallback ?? '';
    }),
  };
  let service: RedisOtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: string): string => {
      const values: Record<string, string> = {
        EMAIL_OTP_MODE: 'fixed',
        EMAIL_OTP_TTL_SECONDS: '600',
      };
      return values[key] ?? fallback ?? '';
    });
    service = new RedisOtpService(redis as never, config as never);
  });

  it('issues fixed OTP 123456 when EMAIL_OTP_MODE=fixed', async () => {
    const otp = await service.issue('jane@example.com', OtpPurpose.EMAIL_VERIFY);

    expect(otp).toBe('123456');
    expect(redis.set).toHaveBeenCalledWith(
      'otp:email_verify:jane@example.com',
      createHash('sha256').update('123456').digest('hex'),
      'EX',
      600,
    );
  });

  it('issues a 6-digit live OTP when EMAIL_OTP_MODE=live', async () => {
    config.get.mockImplementation((key: string, fallback?: string): string => {
      if (key === 'EMAIL_OTP_MODE') return 'live';
      if (key === 'EMAIL_OTP_TTL_SECONDS') return '300';
      return fallback ?? '';
    });

    const otp = await service.issue('jane@example.com', OtpPurpose.PASSWORD_RESET);

    expect(otp).toMatch(/^\d{6}$/);
    expect(redis.set).toHaveBeenCalledWith(
      'otp:password_reset:jane@example.com',
      createHash('sha256').update(otp).digest('hex'),
      'EX',
      300,
    );
  });

  it('verifies and deletes a matching OTP', async () => {
    redis.get.mockResolvedValue(createHash('sha256').update('123456').digest('hex'));

    await expect(
      service.verify('jane@example.com', OtpPurpose.EMAIL_VERIFY, '123456'),
    ).resolves.toBe(true);
    expect(redis.del).toHaveBeenCalledWith('otp:email_verify:jane@example.com');
  });

  it('rejects a mismatched OTP without deleting', async () => {
    redis.get.mockResolvedValue(createHash('sha256').update('123456').digest('hex'));

    await expect(
      service.verify('jane@example.com', OtpPurpose.EMAIL_VERIFY, '000000'),
    ).resolves.toBe(false);
    expect(redis.del).not.toHaveBeenCalled();
  });
});
