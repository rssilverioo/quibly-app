import * as Sentry from '@sentry/node';

/**
 * Sentry error reporting for the API.
 *
 * The DSN doesn't exist yet — the CEO hasn't provided one. Until it does,
 * every export here is a safe no-op: `initSentry()` skips `Sentry.init()`
 * entirely when `SENTRY_DSN` is unset, so nothing is ever initialized,
 * nothing is sent, and nothing warns to the console. The app runs exactly
 * as it does today. The moment the env var is set (no code change needed),
 * this activates.
 */

let enabled = false;

/** Keys that must never leave the process, wherever they show up in an
 *  event's structured fields (not just `event.user`). */
const PII_KEYS = new Set(['email', 'handle', 'username']);

/** Backstop for PII embedded in free text — an exception message built with
 *  a template string, a log line passed as `extra` — rather than a keyed
 *  field. Redacts anything that looks like an email address. */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function scrubString(value: string): string {
  return value.replace(EMAIL_PATTERN, '[redacted-email]');
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    return scrubObject(value as Record<string, unknown>);
  }
  return value;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = PII_KEYS.has(key.toLowerCase()) ? '[redacted]' : scrubValue(value);
  }
  return out;
}

/**
 * Strips PII (email, handle, username — the fields on `Profile` a Sentry
 * event could plausibly carry) before an event leaves the process. Runs on
 * every event regardless of how it was constructed: keyed fields on
 * `extra`/`contexts`, the `user` block, or plain text in a message or
 * exception value.
 */
function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.user) {
    // Keep only the id (Firebase UID) — every other Sentry-supplied field
    // (email, username, ip_address) is PII we don't need to debug an error.
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra);
  }
  if (event.contexts) {
    event.contexts = scrubObject(
      event.contexts as unknown as Record<string, unknown>,
    ) as unknown as Sentry.ErrorEvent['contexts'];
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
}

/** Call once, at process start, before anything that might throw. */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // no DSN yet — stay off, stay silent.

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // No performance tracing yet — this phase is about not flying blind on
    // errors, not full APM. Revisit once Sentry is actually receiving data.
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
  enabled = true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Reports an exception to Sentry. No-ops when Sentry was never
 *  initialized (no DSN configured) — safe to call unconditionally from
 *  anywhere in the app. */
export function captureException(exception: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(exception, extra ? { extra } : undefined);
}

/** Associates future events on this async context with a user id only —
 *  never email or handle. Safe to call unconditionally. */
export function setSentryUser(userId: string | null): void {
  if (!enabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
