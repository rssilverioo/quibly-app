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
    /*
     Normalizar antes de comparar.

     O navegador manda `Origin: https://tryquibly.com` — sem barra final e sem
     aspas. Um valor colado com barra (`https://tryquibly.com/`) ou com aspas
     (`"https://tryquibly.com"`) nunca casa, e o sintoma é o pior possível:
     a variável **está** configurada, o serviço **reiniciou**, e mesmo assim
     toda origem é recusada — sem nada em lugar nenhum dizendo por quê.
     Aconteceu em 10/08 e custou uma rodada inteira de investigação.

     Corrigir aqui é mais barato que documentar o formato: ninguém lê a
     documentação de uma variável de ambiente na hora de colar um domínio.
    */
    .map((origin) => origin.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
    .filter(Boolean);

  // Registrado no boot porque é a única forma de descobrir, de fora, se a
  // variável chegou como se esperava. Domínio permitido não é segredo — é o
  // oposto: é o que a API anuncia a qualquer navegador que pergunte.
  new Logger('Bootstrap').log(
    corsOrigins.length > 0
      ? `CORS liberado para: ${corsOrigins.join(', ')}`
      : 'CORS_ORIGINS vazio — nenhuma origem de navegador será aceita',
  );

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
