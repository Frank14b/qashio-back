import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  // Buffer boot logs until the pino logger is attached, so they carry the same format.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Behind a proxy/load balancer, trust X-Forwarded-For so rate limits see the client IP
  // (e.g. TRUST_PROXY=1 for one hop). Off by default: the header is spoofable otherwise.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()) ?? [
      'http://localhost:3001',
      'http://localhost:4000',
      'http://localhost:3000',
    ],
    credentials: true,
    // Let the browser read the request id to correlate client errors with server logs.
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Qashio API')
      .setDescription(
        [
          'Expense tracker API.',
          '',
          'Use `/auth/register` or `/auth/login` to obtain JWT access and refresh tokens.',
          'Protected routes (when available) expect `Authorization: Bearer <accessToken>`.',
          'Errors follow a consistent body: `statusCode`, `error`, `message`, `path`, `timestamp`.',
        ].join('\n'),
      )
      .setVersion('0.1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token from register, login, or refresh',
          in: 'header',
        },
        'bearer',
      )
      .addTag('health', 'Liveness / readiness probes (public)')
      .addTag('auth', 'Registration, login, token refresh, and logout')
      .addTag('currencies', 'Seeded ISO 4217 reference currencies')
      .addTag('accounts', 'User wallets (Bearer access token required)')
      .addTag('categories', 'User categories (Bearer access token required)')
      .addTag('transactions', 'Income / expense entries on wallets (Bearer access token required)')
      .addTag('budgets', 'Spending limits per category and period (Bearer access token required)')
      .addTag('notifications', 'In-app notifications (Bearer access token required)')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
