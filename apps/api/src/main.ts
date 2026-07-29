import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SnakeCaseInterceptor } from './common/interceptors/snake-case.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JsonLogger } from './common/logger/json-logger.service';
import { initSentry } from './observability/sentry';

// Must run before anything else has a chance to throw. No-ops entirely if
// SENTRY_DSN isn't set — see observability/sentry.ts.
initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    // Buffer logs emitted during module init so they still go through
    // JsonLogger once it's attached below, instead of the default logger.
    bufferLogs: true,
  });

  app.useLogger(new JsonLogger());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.use(helmet());

  const configService = app.get(ConfigService);

  // CORS_ORIGINS is a comma-separated allowlist, e.g.
  // "https://tryquibly.com,https://app.tryquibly.com". Falls back to no
  // cross-origin access at all if unset, rather than opening the API up —
  // the mobile app doesn't send an Origin header, so this only gates browser
  // clients (the web app, and anyone else trying to call the API from a page).
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new SnakeCaseInterceptor());

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');
  Logger.log(`Quibly API is running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
