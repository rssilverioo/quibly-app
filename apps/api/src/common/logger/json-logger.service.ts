import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Structured (JSON, one line per entry) logger, wired in as the app-wide
 * Nest logger in `main.ts`. Replaces the default colorized/pretty console
 * output — every existing `new Logger(SomeService.name)` call site keeps
 * working unchanged (Nest's `Logger` delegates to whatever is registered
 * via `app.useLogger()`); only the transport/format changes.
 *
 * Why this matters: Railway (and anything else that ships logs to a
 * search/alerting backend) works far better against `{"level":...}` lines
 * than against free text. This is the "logger estruturado" half of the
 * observability work — Sentry (see `observability/sentry.ts`) covers the
 * "an engineer gets paged" half.
 */
export class JsonLogger implements LoggerService {
  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : safeStringify(message),
    };
    if (context) entry.context = context;
    if (trace) entry.trace = trace;

    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
