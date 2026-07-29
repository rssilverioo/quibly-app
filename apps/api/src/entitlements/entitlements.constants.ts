import { Plan } from '@prisma/client';

/**
 * Everything the app currently gates by plan. Add a key here first — the
 * `Entitlement` DB row (and any admin UI for it) comes after.
 */
export type EntitlementKey =
  | 'flashcard_sets'
  | 'quizzes'
  | 'audio_sessions'
  | 'ai_daily_tokens';

export const ENTITLEMENT_KEYS: EntitlementKey[] = [
  'flashcard_sets',
  'quizzes',
  'audio_sessions',
  'ai_daily_tokens',
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
 */
export const DEFAULT_ENTITLEMENTS: Record<Plan, Record<EntitlementKey, number>> = {
  FREE: {
    flashcard_sets: Infinity,
    quizzes: Infinity,
    audio_sessions: Infinity,
    ai_daily_tokens: Infinity,
  },
  PRO: {
    flashcard_sets: Infinity,
    quizzes: Infinity,
    audio_sessions: Infinity,
    ai_daily_tokens: Infinity,
  },
};
