import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export type ErrorResponseBody = {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  /** Same value as the X-Request-Id response header; quote it to find the server logs. */
  requestId?: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, error, message } = this.normalize(exception);

    if (!(exception instanceof HttpException)) {
      // Unexpected: log the exception itself (pino `err`) so Sentry's pino integration
      // reports it once, with its real stack and this request's context.
      this.logger.error(exception instanceof Error ? exception : String(exception));
    } else if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Deliberate 5xx (e.g. health 503): worth a log line, not an error report.
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}`);
    }

    const body: ErrorResponseBody = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      // Set by pino-http (LoggingModule) for every request.
      requestId: (request as Request & { id?: string }).id,
    };

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return {
          statusCode,
          error: HttpStatus[statusCode] ?? 'Error',
          message: payload,
        };
      }

      const objectPayload = payload as {
        error?: string;
        message?: string | string[];
      };

      return {
        statusCode,
        error: objectPayload.error ?? HttpStatus[statusCode] ?? 'Error',
        message: objectPayload.message ?? exception.message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }
}
