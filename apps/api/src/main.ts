import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const portValue = process.env.PORT ?? '3001';
  const port = Number(portValue);

  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  try {
    await app.listen(port, '127.0.0.1');
    Logger.log(`API listening at http://127.0.0.1:${port}`, 'Bootstrap');
  } catch (error: unknown) {
    await app.close();
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : 'API startup failed.', 'Bootstrap');
  process.exitCode = 1;
});
