import { baseEnvSchema, parseEnv } from './env';

const minimal = {
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/qashio_points',
  JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
};

const production = {
  ...minimal,
  NODE_ENV: 'production',
  EMAIL_OTP_MODE: 'live',
  JWT_ACCESS_SECRET: 'a-unique-production-secret-of-40-characters!!',
};

describe('env schema', () => {
  it('applies defaults and coerces types', () => {
    const env = parseEnv({ ...minimal, PORT: '8080', SEED_CURRENCIES: 'false', SENTRY_ENABLED: '' });

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 8080,
      SEED_CURRENCIES: false,
      SENTRY_ENABLED: false,
      EMAIL_OTP_MODE: 'fixed',
      RATE_LIMIT_PER_MINUTE: 120,
    });
  });

  it('parses CORS_ORIGIN into a validated list', () => {
    expect(parseEnv({ ...minimal, CORS_ORIGIN: 'http://a.test, http://b.test' }).CORS_ORIGIN).toEqual(
      ['http://a.test', 'http://b.test'],
    );
    expect(() => parseEnv({ ...minimal, CORS_ORIGIN: 'not-a-url' })).toThrow('CORS_ORIGIN');
  });

  it('reports every problem at once', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://x', PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_ACCESS_SECRET|JWT_ACCESS_SECRET[\s\S]*DATABASE_URL/,
    );
  });

  it('requires a DSN when Sentry is enabled', () => {
    expect(() => parseEnv({ ...minimal, SENTRY_ENABLED: 'true' })).toThrow('SENTRY_DSN');
    expect(
      parseEnv({ ...minimal, SENTRY_ENABLED: 'true', SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1' })
        .SENTRY_ENABLED,
    ).toBe(true);
  });

  describe('production guardrails', () => {
    it('accepts a hardened production config', () => {
      expect(parseEnv(production).NODE_ENV).toBe('production');
    });

    it('rejects the fixed OTP mode (always 123456)', () => {
      expect(() => parseEnv({ ...production, EMAIL_OTP_MODE: 'fixed' })).toThrow('EMAIL_OTP_MODE');
    });

    it('rejects the example or a short JWT secret', () => {
      expect(() => parseEnv({ ...production, JWT_ACCESS_SECRET: minimal.JWT_ACCESS_SECRET })).toThrow(
        'JWT_ACCESS_SECRET',
      );
      expect(() =>
        parseEnv({ ...production, JWT_ACCESS_SECRET: 'only-twenty-five-chars!!' }),
      ).toThrow('JWT_ACCESS_SECRET');
    });
  });

  it('lets the migration CLI validate only DATABASE_URL', () => {
    const schema = baseEnvSchema.pick({ DATABASE_URL: true });
    expect(parseEnv({ DATABASE_URL: minimal.DATABASE_URL }, schema)).toEqual({
      DATABASE_URL: minimal.DATABASE_URL,
    });
  });
});
