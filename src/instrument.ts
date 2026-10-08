import * as Sentry from '@sentry/nestjs';
import { loadEnv } from './shared/config/env';

/**
 * Runs first in main.ts: validates the environment (fail fast, listing every
 * problem) and initialises Sentry before any other module is loaded, since it
 * instruments http, express, pg, ioredis… as they are required.
 */
const env = loadEnv();

// Off unless SENTRY_ENABLED=true (the schema then requires SENTRY_DSN).
if (env.SENTRY_ENABLED) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.APP_VERSION,
    // Performance tracing is opt-in (0 = errors only).
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Bodies carry passwords, OTPs and tokens: never send them, nor cookies or user info.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
      httpHeaders: { request: { deny: ['authorization', 'cookie'] }, response: false },
    },
    integrations: [
      // Errors that are logged and swallowed (event listeners, email) still reach Sentry.
      Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] }, log: { levels: [] } }),
    ],
  });
}
