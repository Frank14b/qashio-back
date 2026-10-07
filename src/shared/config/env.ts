import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().positive();
// z.url() alone accepts `localhost:3000` (scheme "localhost:"); require http(s).
const httpUrl = z.url({ protocol: /^https?$/, error: 'must be an http(s):// URL' });
/** The example secret shipped in .env.example; never acceptable in production. */
const EXAMPLE_JWT_SECRET = 'dev-access-secret-change-me';

/**
 * Every environment variable the API reads, with defaults matching local dev.
 * Plain object (no refinements) so subsets can be picked, e.g. by the
 * migration CLI which only needs DATABASE_URL.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: port.default(3000),
  /** Comma-separated browser origins allowed by CORS. */
  CORS_ORIGIN: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(httpUrl))
    .optional(),
  TRUST_PROXY: z.string().optional(),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),

  REDIS_URL: z.url({ protocol: /^rediss?$/, error: 'must be a redis:// URL' }).optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: port.default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'must look like 15m, 1h or 7d')
    .default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: positiveInt.max(365).default(30),

  EMAIL_OTP_MODE: z.enum(['fixed', 'live']).default('fixed'),
  EMAIL_OTP_TTL_SECONDS: positiveInt.min(60).max(86_400).default(600),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: port.default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.email().default('noreply@qashio.local'),

  SEED_CURRENCIES: z.stringbool().default(true),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_PER_MINUTE: positiveInt.default(120),
  HEALTH_MEMORY_HEAP_MB: positiveInt.default(512),
  HEALTH_MEMORY_RSS_MB: positiveInt.default(1024),
  APP_VERSION: z.string().optional(),

  SENTRY_ENABLED: z.stringbool().default(false),
  SENTRY_DSN: httpUrl.optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.SENTRY_ENABLED && !env.SENTRY_DSN) {
    ctx.addIssue({
      code: 'custom',
      path: ['SENTRY_DSN'],
      message: 'is required when SENTRY_ENABLED=true',
    });
  }
  if (env.NODE_ENV !== 'production') {
    return;
  }
  if (env.EMAIL_OTP_MODE !== 'live') {
    ctx.addIssue({
      code: 'custom',
      path: ['EMAIL_OTP_MODE'],
      message: "must be 'live' in production (fixed mode always issues 123456)",
    });
  }
  if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_ACCESS_SECRET === EXAMPLE_JWT_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_ACCESS_SECRET'],
      message: 'must be a unique secret of at least 32 characters in production',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

/** `KEY=` in .env or an empty CI variable means "not set", so defaults apply. */
function withoutEmptyValues(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
}

/**
 * Validates raw variables against `schema`; throws one error listing every
 * problem. Also used as ConfigModule's `validate`, so ConfigService returns
 * these typed values.
 */
export function parseEnv<S extends z.ZodType = typeof envSchema>(
  raw: Record<string, unknown>,
  schema: S = envSchema as unknown as S,
): z.infer<S> {
  const result = schema.safeParse(withoutEmptyValues(raw));
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * Loads `.env` (if present; real environment variables win) and validates
 * `process.env` once. For code that runs outside Nest's ConfigModule:
 * instrument.ts, main.ts bootstrap.
 */
export function loadEnv(): Env {
  if (!cached) {
    const envFile = join(process.cwd(), '.env');
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
    cached = parseEnv(process.env);
  }
  return cached;
}
