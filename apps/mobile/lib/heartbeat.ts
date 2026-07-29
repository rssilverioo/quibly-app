import { ApiError } from './http-errors';

/**
 * The heartbeat that keeps a study session alive.
 *
 * ## Why this is more than `setInterval(post, 30_000)`
 *
 * People study in libraries, basements and buses. A beat that fails because the
 * signal dropped for ninety seconds must not cost the user their session — and
 * it doesn't have to, because of how the server treats a missed beat: a session
 * is swept only after five minutes of silence, and even then it is credited up
 * to its **last** beat. So a beat that lands late still buys back the whole gap
 * it covers, as long as it lands before the grace window closes.
 *
 * That single fact drives the design:
 *
 * - **Retry aggressively inside the window, give up outside it.** A beat older
 *   than the grace window can no longer save the session, so retrying it is
 *   pure battery burn.
 * - **Never queue more than one pending beat.** Beats are not events to be
 *   replayed; they are a liveness signal. Ten stale beats say exactly what one
 *   fresh beat says, so the queue is a single slot that newer beats overwrite.
 * - **Back off, but never past the window.** Exponential up to a ceiling that
 *   keeps at least a couple of attempts inside the grace period.
 *
 * ## What this deliberately does not do
 *
 * It does not compute elapsed time. It reports the server's `elapsed_seconds`
 * back to its owner via `onTick` and holds no clock of its own. The whole point
 * of Fase 1 is that the client stopped being a source of truth about time.
 */

/** Matches the server's `HEARTBEAT_INTERVAL_SECONDS`. */
const BEAT_INTERVAL_MS = 30_000;

/**
 * Matches the server's `HEARTBEAT_GRACE_SECONDS`. Overridden at runtime from
 * the value the API hands back on `start`, so loosening the window server-side
 * does not need an app release.
 */
const DEFAULT_GRACE_MS = 5 * 60_000;

const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;

export interface HeartbeatSnapshot {
  elapsedSeconds: number;
  status: 'active' | 'paused';
  /** Server clock at the time of the beat, for drift detection by the caller. */
  serverTime: string;
}

export interface HeartbeatOptions {
  sessionId: string;
  /** Injected so tests don't hit the network and the store can swap transports. */
  send: (sessionId: string) => Promise<HeartbeatSnapshot>;
  /** Called after every beat that lands. This is the reconciliation point. */
  onTick?: (snapshot: HeartbeatSnapshot) => void;
  /**
   * Called when beats have been failing for longer than the grace window — the
   * session is now presumed lost server-side and the UI should say so rather
   * than keep animating a timer that is no longer running anywhere.
   */
  onGraceExpired?: () => void;
  /** Called when the server rejects the session outright (404/400): it is over. */
  onSessionGone?: (error: ApiError) => void;
  graceMs?: number;
  intervalMs?: number;
}

export class HeartbeatController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;
  /** When the last *successful* beat landed. The grace window measures from here. */
  private lastSuccessAt = 0;
  private backoffMs = INITIAL_BACKOFF_MS;
  private graceNotified = false;

  private readonly intervalMs: number;
  private readonly graceMs: number;

  constructor(private readonly opts: HeartbeatOptions) {
    this.intervalMs = opts.intervalMs ?? BEAT_INTERVAL_MS;
    this.graceMs = opts.graceMs ?? DEFAULT_GRACE_MS;
  }

  /**
   * Begin beating. The first beat fires immediately rather than after one
   * interval: a session that starts and is backgrounded within 30s would
   * otherwise have no beat at all on record.
   */
  start(now = Date.now()): void {
    if (this.running) return;
    this.running = true;
    this.lastSuccessAt = now;
    this.graceNotified = false;
    this.backoffMs = INITIAL_BACKOFF_MS;
    void this.beat();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Beat right now, out of band — call this when the app returns to the
   * foreground. Coming back from background is exactly when the local picture
   * is most likely to be stale, so it is worth a beat rather than waiting out
   * the remainder of the interval.
   */
  async beatNow(): Promise<void> {
    if (!this.running || this.inFlight) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.beat();
  }

  private schedule(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.beat(), delayMs);
  }

  private async beat(): Promise<void> {
    if (!this.running || this.inFlight) return;
    this.inFlight = true;

    try {
      const snapshot = await this.opts.send(this.opts.sessionId);

      this.lastSuccessAt = Date.now();
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.graceNotified = false;
      this.opts.onTick?.(snapshot);

      this.schedule(this.intervalMs);
    } catch (err) {
      this.handleFailure(err);
    } finally {
      this.inFlight = false;
    }
  }

  private handleFailure(err: unknown): void {
    // A 4xx that isn't rate limiting means this session is not ours to beat any
    // more — it ended, it was swept, or it never existed. Retrying cannot fix
    // that, and pretending otherwise leaves the UI showing a dead timer.
    if (err instanceof ApiError && !err.isRetryable) {
      this.stop();
      this.opts.onSessionGone?.(err);
      return;
    }

    const silentFor = Date.now() - this.lastSuccessAt;
    if (silentFor >= this.graceMs) {
      // Past the window: the server has already swept, or is about to. Further
      // beats cannot save this session, so stop draining the battery.
      if (!this.graceNotified) {
        this.graceNotified = true;
        this.opts.onGraceExpired?.();
      }
      this.stop();
      return;
    }

    // Everything that reaches here — a NetworkError, a 5xx, a 429, or a failure
    // shape we didn't anticipate — is treated as transient. Killing a live
    // session over an unrecognised error would be the worse mistake: the grace
    // check above already bounds how long we can be wrong for.

    // Back off, but never so far that we'd skip past the end of the window.
    const remainingInWindow = Math.max(0, this.graceMs - silentFor);
    const delay = Math.min(this.backoffMs, MAX_BACKOFF_MS, remainingInWindow || this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.schedule(delay);
  }
}
