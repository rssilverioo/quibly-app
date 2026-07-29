/**
 * Error reporting.
 *
 * The DSN doesn't exist yet — the CEO hasn't provided one. Until it does,
 * `initSentry()` is a deliberate no-op: without `EXPO_PUBLIC_SENTRY_DSN`,
 * `Sentry.init()` is never called, so nothing initializes, nothing is sent,
 * and nothing prints a warning to the device log. The app behaves exactly
 * as it does today. The moment the env var is filled in (no code change
 * needed), this activates — `Sentry.init()` in React Native automatically
 * wires up global JS error and unhandled-promise-rejection handlers, plus
 * native crash reporting, so most crashes are covered without touching
 * every call site.
 *
 * PII: `captureException`/`captureMessage` scrub anything that looks like
 * an email out of the message and `extra` before it's handed to the SDK,
 * and `identifyForSentry` only ever sends a user id — never email or
 * handle, both of which live on `Profile`.
 */
import * as Sentry from '@sentry/react-native';

let enabled = false;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PII_KEYS = new Set(['email', 'handle', 'username']);

function scrubString(value: string): string {
  return value.replace(EMAIL_PATTERN, '[redacted-email]');
}

function scrubExtra(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extra) return extra;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else if (typeof value === 'string') {
      out[key] = scrubString(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Called once at app boot, before anything else that might throw. Safe to
 *  call multiple times. */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || enabled) return; // no DSN yet — stay off, stay silent.

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // No performance tracing yet — this is about knowing when the app
    // crashes in production, not full APM.
    tracesSampleRate: 0,
    beforeSend: (event) => {
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : undefined;
      }
      if (event.extra) {
        event.extra = scrubExtra(event.extra as Record<string, unknown>);
      }
      if (typeof event.message === 'string') {
        event.message = scrubString(event.message);
      }
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((v) => ({
          ...v,
          value: typeof v.value === 'string' ? scrubString(v.value) : v.value,
        }));
      }
      return event;
    },
  });
  enabled = true;
}

/** Reports an error. No-ops when Sentry was never initialized (no DSN) —
 *  safe to call unconditionally from any catch block. */
export function captureException(exception: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(exception, extra ? { extra: scrubExtra(extra) } : undefined);
}

/** Ties future events to a user id only — never email or handle. Pass
 *  `null` on sign-out. Safe to call unconditionally. */
export function identifyForSentry(userId: string | null): void {
  if (!enabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
