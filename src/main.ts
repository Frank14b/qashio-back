import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
    .addTag('auth', 'Registration, login, token refresh, and logout')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
