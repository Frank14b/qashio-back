import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { LoggerModule } from 'nestjs-pino';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept a caller-provided id only if it is a plain token (no log injection).
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Structured request logging (pino). Every request gets an id — the caller's
 * `X-Request-Id` when valid, otherwise a new UUID — echoed back in the response
 * header. nestjs-pino keeps it in AsyncLocalStorage, so every log line written
 * while handling the request (including async event listeners it triggers)
 * carries the same `req.id`.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers[REQUEST_ID_HEADER];
            const id =
              typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader('X-Request-Id', id);
            // Tag this request's Sentry events so they link to its logs (no-op when disabled).
            Sentry.getIsolationScope().setTag('request_id', id);
            return id;
          },
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          autoLogging: { ignore: (req: IncomingMessage) => req.url?.startsWith('/health') ?? false },
          transport:
            config.get<string>('NODE_ENV') === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
