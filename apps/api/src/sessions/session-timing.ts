/**
 * Pure time arithmetic for study sessions. No Prisma, no Nest, no clock of its
 * own — every instant comes in as an argument. This is where the server stops
 * trusting the client about how long someone studied, so it is the part that
 * has to be testable without a database.
 *
 * See docs/API-SESSIONS.md for the contract these numbers back.
 */

/**
 * The client is expected to beat every 30s. Anything under a minute would make
 * one dropped request look like an abandoned session.
 */
export const HEARTBEAT_INTERVAL_SECONDS = 30;

/**
 * How long a live session may go without a heartbeat before the sweeper calls
 * it abandoned.
 *
 * Five minutes = ten missed beats. Deliberately generous: mobile networks drop,
 * iOS suspends background work aggressively, and Android dozes. The cost of
 * being *too* generous is bounded — a swept session is credited only up to its
 * last heartbeat, never up to the sweep — so a long window costs nothing but a
 * delay in marking the row. The cost of being too tight is the opposite: real
 * study time silently thrown away. Asymmetric risk, so err long.
 */
export const HEARTBEAT_GRACE_SECONDS = 5 * 60;

/**
 * Ceiling on credited study time per user per calendar day.
 *
 * 16h is not a measurement — this codebase has no production data to fit it to
 * (see docs/API-SESSIONS.md §5, "o número que falta"). It is a deliberately
 * loose sanity bound: above the ~12–14h that the heaviest real YPT users log,
 * below the 24h that a scripted heartbeat loop would produce. It exists to
 * make forgery non-trivial and to leave a trail, not to police anyone.
 *
 * It is overridable per plan through `EntitlementsService` (key
 * `daily_study_minutes_cap`), so tightening it once real data exists is a DB
 * write, not a deploy.
 */
export const DEFAULT_DAILY_STUDY_MINUTES_CAP = 16 * 60;

export type SessionAnomalyKind =
  /** A start was refused because the user already had a live session. */
  | 'overlap_rejected'
  /** The daily cap clipped how much of a session got credited. */
  | 'daily_cap_clipped'
  /** A session ran past the cap on its own — one sitting, not a day's worth. */
  | 'implausible_duration'
  /** A live session went quiet past the grace window and was swept. */
  | 'heartbeat_gap';

export interface PauseInterval {
  startedAt: Date;
  /** `null` while the pause is still open. */
  endedAt: Date | null;
}

/**
 * Milliseconds of `[from, to]` that fall inside a pause.
 *
 * An open pause (`endedAt === null`) is treated as running until `to`, which is
 * what makes "swept while paused" come out right: `to` is the last heartbeat,
 * so the pause is clipped there rather than to the sweep time.
 *
 * Intervals are clamped to the window and to non-negative length, so a clock
 * skew or an out-of-order write can never *add* time.
 */
export function pausedMillisWithin(
  pauses: readonly PauseInterval[],
  from: Date,
  to: Date,
): number {
  const windowStart = from.getTime();
  const windowEnd = to.getTime();
  if (windowEnd <= windowStart) return 0;

  let total = 0;
  for (const pause of pauses) {
    const start = Math.max(pause.startedAt.getTime(), windowStart);
    const end = Math.min((pause.endedAt ?? to).getTime(), windowEnd);
    if (end > start) total += end - start;
  }
  // Overlapping pause rows would double-count. They cannot happen through the
  // API (pause is rejected unless the session is `active`), but a clamp here is
  // cheaper than trusting that forever.
  return Math.min(total, windowEnd - windowStart);
}

/**
 * Seconds a session actually ran: wall clock from start to end, minus pauses.
 * Never negative.
 */
export function measuredSeconds(
  startedAt: Date,
  endedAt: Date,
  pauses: readonly PauseInterval[],
): number {
  const gross = endedAt.getTime() - startedAt.getTime();
  if (gross <= 0) return 0;
  const net = gross - pausedMillisWithin(pauses, startedAt, endedAt);
  return Math.max(0, Math.floor(net / 1000));
}

export interface CreditedDuration {
  /** What the session actually ran, before the cap. */
  measuredSeconds: number;
  /** What gets written to `totalDurationMinutes`, two decimals. */
  creditedMinutes: number;
  /** True when the daily cap, not the user, decided the number. */
  clippedByDailyCap: boolean;
}

/**
 * Turn measured seconds into credited minutes, applying the per-day ceiling.
 *
 * `alreadyCreditedMinutesToday` is the sum this user has already banked today;
 * a session that would push the day past `dailyCapMinutes` is credited only up
 * to the remainder. The overflow is not queued or refunded — it is dropped, and
 * the caller records a `daily_cap_clipped` anomaly.
 */
export function creditedDuration(
  measured: number,
  alreadyCreditedMinutesToday: number,
  dailyCapMinutes: number,
): CreditedDuration {
  const rawMinutes = measured / 60;
  if (!Number.isFinite(dailyCapMinutes)) {
    return {
      measuredSeconds: measured,
      creditedMinutes: round2(rawMinutes),
      clippedByDailyCap: false,
    };
  }

  const remaining = Math.max(0, dailyCapMinutes - alreadyCreditedMinutesToday);
  const credited = Math.min(rawMinutes, remaining);
  return {
    measuredSeconds: measured,
    creditedMinutes: round2(credited),
    // Only a *reduction* counts as clipping. A session that fits exactly is not
    // clipped, and neither is a zero-length one.
    clippedByDailyCap: credited < rawMinutes - 1e-9,
  };
}

/**
 * How many pomodoro cycles the session earned — derived, never reported.
 *
 * This used to arrive in the request body alongside the duration, which made it
 * the second client-controlled input into `calculateScore` (it drives both the
 * participation SP and the per-cycle bonus). The formula in
 * `packages/shared/src/scoring.ts` is untouched; only where this number comes
 * from changed.
 *
 * `stopwatch` and `audio` have no target duration, so they earn no cycles.
 */
export function completedCycles(
  timerMode: string,
  creditedMinutes: number,
  workDurationMinutes: number,
): number {
  if (timerMode === 'stopwatch' || timerMode === 'audio') return 0;
  if (workDurationMinutes <= 0) return 0;
  return Math.floor(creditedMinutes / workDurationMinutes);
}

/**
 * Whether the user bailed before finishing a single planned work block.
 *
 * Only `hardcore` leagues penalise this. The old definition compared the
 * client's minutes against `workDuration × client's cycle count`, which is
 * circular once cycles are derived from minutes — it would never fire. This is
 * the server-side reading of the same intent: you did not complete one block.
 *
 * A `stopwatch` session has no block to fall short of, so it never ends early.
 */
export function endedEarly(
  timerMode: string,
  creditedMinutes: number,
  workDurationMinutes: number,
): boolean {
  if (timerMode === 'stopwatch' || timerMode === 'audio') return false;
  if (workDurationMinutes <= 0) return false;
  return creditedMinutes < workDurationMinutes;
}

/**
 * The instant a live session should be credited up to, given it went quiet.
 * A session that never beat at all is credited up to its start — zero minutes —
 * rather than up to the sweep, which is the whole point of the heartbeat.
 */
export function sweepCreditInstant(
  startedAt: Date,
  lastHeartbeatAt: Date | null,
): Date {
  if (!lastHeartbeatAt) return startedAt;
  return lastHeartbeatAt.getTime() > startedAt.getTime() ? lastHeartbeatAt : startedAt;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
