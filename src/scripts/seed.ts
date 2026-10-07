import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedCurrenciesUseCase } from '../modules/currencies/application/seed-currencies.use-case';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const seed = app.get(SeedCurrenciesUseCase);
    const result = await seed.execute();
    console.log(`Seeded ${result.upserted} currencies (upsert by code).`);
  } finally {
    await app.close();
  }
}

void bootstrap();
