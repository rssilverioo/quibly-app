import { Injectable, Logger } from '@nestjs/common';
import {
  UNKNOWN_COUNTRY_CODE,
  UNKNOWN_EXAM_TRACK,
  type AnalyticsEventProps,
  type AnalyticsEvents,
  type Plan,
  type ServerSourcedEvent,
} from '@quibly/shared';

export interface ServerAnalyticsContext {
  /** Firebase UID — the same id every other server write is keyed on. */
  userId: string;
  /** Pass it when the caller already has it in hand (e.g. mid-transaction);
   *  falling back to `'FREE'` only affects this log line, never billing. */
  plan?: Plan;
}

/**
 * Server-side half of the analytics taxonomy (`@quibly/shared/analytics-events`).
 *
 * Money-deciding and AI-loop-closing events can't depend on the client — see
 * that file's header and docs/ARCHITECTURE.md §3. This service is where
 * those events actually get emitted, from the exact code path that already
 * has the authoritative data (session duration, processing time, the
 * RevenueCat webhook payload).
 *
 * Deliberately NOT wired to a network sink yet: shipping this taxonomy is
 * Fase 0's job, choosing/paying for a destination is not (see
 * docs/prompts/F0-observabilidade-analytics.md §4 — "não integre [PostHog]
 * antes da aprovação"). Every call below lands as one structured JSON line
 * per event, which is enough to grep in Railway logs today and is the exact
 * shape a log drain or a plain `fetch` to PostHog's HTTP capture endpoint
 * would forward once that recommendation is approved — no SDK, no new
 * dependency needed for that step either.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('Analytics');

  track<E extends ServerSourcedEvent>(
    event: E,
    ctx: ServerAnalyticsContext,
    properties: AnalyticsEventProps[E],
  ): void {
    const payload: AnalyticsEvents[E] = {
      // country_code / exam_track: 'unknown' until Fase 1 puts them on Profile.
      country_code: UNKNOWN_COUNTRY_CODE,
      exam_track: UNKNOWN_EXAM_TRACK,
      plan: ctx.plan ?? 'FREE',
      // These two describe the *client* build; a server-originated event has
      // no client build to report, so they're structurally present (every
      // event carries them) but not meaningful here.
      app_version: 'server',
      platform: 'unknown',
      ...properties,
    } as AnalyticsEvents[E];

    // Never throw — analytics must not break the request it's observing.
    try {
      this.logger.log(
        JSON.stringify({ event, distinct_id: ctx.userId, properties: payload }),
      );
    } catch {
      // Swallow serialization edge cases (e.g. a caller sneaks in a cyclic
      // value); losing one analytics line is fine, failing the request isn't.
    }
  }
}
