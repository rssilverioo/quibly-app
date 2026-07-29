import { Plan } from '@prisma/client';
// `session-timing` is a dependency-free leaf of pure functions and numbers, so
// importing it here creates no cycle. Pulling the value from there rather than
// restating 960 keeps the cap defined in exactly one place.
import { DEFAULT_DAILY_STUDY_MINUTES_CAP } from '../sessions/session-timing';

/**
 * Everything the app currently gates by plan. Add a key here first — the
 * `Entitlement` DB row (and any admin UI for it) comes after.
 */
export type EntitlementKey =
  | 'flashcard_sets'
  | 'quizzes'
  | 'audio_sessions'
  | 'ai_daily_tokens'
  | 'daily_study_minutes_cap';

export const ENTITLEMENT_KEYS: EntitlementKey[] = [
  'flashcard_sets',
  'quizzes',
  'audio_sessions',
  'ai_daily_tokens',
  'daily_study_minutes_cap',
];

/**
 * Fallback used whenever a (plan, key) row doesn't exist in
 * `quibly_entitlements` — including "the table hasn't been seeded at all",
 * which is the actual Fase 0 launch state.
 *
 * Business decision (ARCHITECTURE.md §3, "Entitlements desde já, com tudo
 * ligado"): we launch free. Every limit, for every plan, starts at Infinity —
 * including PRO's current `audio_sessions: 5`, which this intentionally
 * loosens. Turning a limit on for Fase 7 is a write to `quibly_entitlements`
 * (or `EntitlementsService.setLimit`), never a deploy.
 *
 * `daily_study_minutes_cap` is the one exception, and it is not a monetization
 * lever at all — it is the antifraud ceiling on credited study time, and an
 * infinite one would mean a scripted heartbeat loop could bank 24h a day
 * against a public ranking. It rides on this table for the same reason the
 * others do: tightening it once real usage data exists should be a DB write,
 * not a deploy.
 */
export const DEFAULT_ENTITLEMENTS: Record<Plan, Record<EntitlementKey, number>> = {
  FREE: {
    flashcard_sets: Infinity,
    quizzes: Infinity,
    audio_sessions: Infinity,
    ai_daily_tokens: Infinity,
    daily_study_minutes_cap: DEFAULT_DAILY_STUDY_MINUTES_CAP,
  },
  PRO: {
    flashcard_sets: Infinity,
    quizzes: Infinity,
    audio_sessions: Infinity,
    ai_daily_tokens: Infinity,
    daily_study_minutes_cap: DEFAULT_DAILY_STUDY_MINUTES_CAP,
  },
};
