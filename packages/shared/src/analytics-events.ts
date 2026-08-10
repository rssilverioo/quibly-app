/**
 * Canonical analytics taxonomy — the single source of truth for event names
 * and event properties across mobile and API.
 *
 * Why this file exists (docs/ARCHITECTURE.md §1): the North Star is
 * **minutos de estudo verificado por usuário por semana**. Every event below
 * exists to explain that number going up or down. If an event doesn't answer
 * a business question tied to activation, habit, the social loop, the AI
 * loop, or monetization, it does not belong here — see
 * `docs/prompts/F0-observabilidade-analytics.md` ("não instrumente tela por
 * tela").
 *
 * Rules that keep the data usable:
 *  - This is a **closed union**. A typo in an event name is a compile error,
 *    not a silently missing funnel step. Mobile and API both import from
 *    here — no literal event-name strings anywhere else in the codebase.
 *  - Every event carries `country_code` × `exam_track` (docs/ARCHITECTURE.md
 *    §2). That cut is what decides which country opens next — it is not
 *    optional, even though the underlying `Profile.countryCode` /
 *    `Profile.examTrackId` columns don't exist yet (they land in Fase 1).
 *    Until then both fields carry the literal string `"unknown"` — callers
 *    must not invent a value, and readers must treat `"unknown"` as "not yet
 *    instrumented," not as a real segment.
 *  - `SERVER_SOURCED_EVENTS` are fired from API code only. The client can
 *    lie about a session's duration, get killed mid-session, or never call
 *    the endpoint that would report a failure — money and the AI loop can't
 *    depend on it (docs/ARCHITECTURE.md §3, "Sessão com autoridade no
 *    servidor").
 *  - Names are snake_case, past tense (GA4's convention; PostHog is happy
 *    with it too) so one name works in both sinks.
 *  - No PII beyond what's already on the profile (email/handle). Property
 *    values are scalars only.
 */
import type { Plan } from './types';

/** `web` is reserved for a future marketing site; the app only ever reports ios/android. */
export type AnalyticsPlatform = 'ios' | 'android' | 'web' | 'unknown';

/** Placeholder until `Profile.countryCode` ships (Fase 1, ARCHITECTURE.md §4). */
export const UNKNOWN_COUNTRY_CODE = 'unknown';
/** Placeholder until `Profile.examTrackId` ships (Fase 1, ARCHITECTURE.md §2 and §4). */
export const UNKNOWN_EXAM_TRACK = 'unknown';

/**
 * Present on every event, client or server. `country_code` and `exam_track`
 * are the cut that decides which country opens next post-Brasil — see
 * ARCHITECTURE.md §2. They fall back to `"unknown"` until Fase 1 populates
 * `Profile.countryCode` / `Profile.examTrackId`.
 */
export interface AnalyticsBaseProperties {
  /** ISO 3166-1 alpha-2, e.g. "BR". `"unknown"` until Fase 1. */
  country_code: string;
  /** ExamTrack slug, e.g. "enem", "oab". `"unknown"` until Fase 1. */
  exam_track: string;
  /** The user's current entitlement plan — not to be confused with the
   *  billing-cycle `selected_plan` used in the monetization funnel below. */
  plan: Plan;
  app_version: string;
  platform: AnalyticsPlatform;
}

/** Sentinel for "this event has no properties beyond the base set." Kept as
 *  an explicit empty-object shape (rather than `undefined`) so every event
 *  uniformly carries at least the base properties. */
type NoExtraProps = Record<string, never>;

/**
 * Each event's *own* properties — the base set (`AnalyticsBaseProperties`)
 * is added on top by `AnalyticsEvents` below. Callers (mobile's `track()`,
 * the API's analytics service) index this directly instead of going through
 * a computed `Omit<...>`, which keeps TypeScript's inference fast and
 * predictable at call sites.
 */
export interface AnalyticsEventProps {
  // ── Ativação ─────────────────────────────────────────────────────────────
  /** Denominator for the auth step of activation. */
  login_succeeded: { method: 'apple' | 'google' };
  /** Top of the onboarding funnel — denominator for onboarding_completed. */
  onboarding_started: NoExtraProps;
  onboarding_step_completed: { step: number; total: number };
  onboarding_completed: { education_level: string; study_goal: string; subjects_count: number };
  /** Left onboarding without finishing — `step` shows where it leaks. */
  onboarding_abandoned: { step: number };
  /**
   * Defined ahead of the UI on purpose: the curriculum picker (Country →
   * ExamTrack, ARCHITECTURE.md §2) doesn't exist yet, so nothing emits this
   * today. Wire it into onboarding the moment that step ships in Fase 1 —
   * don't invent a screen for it now.
   */
  exam_track_selected: { selected_exam_track: string };
  /** `session_started`, scoped to a user's very first session ever. */
  first_session_started: { subject_id?: string };
  /** `session_completed`, scoped to a user's very first session ever. */
  first_session_completed: { minutes: number };

  // ── Hábito ───────────────────────────────────────────────────────────────
  session_started: { timer_mode: string; work_minutes: number };
  /** [SERVER] Duration, points and verification are computed server-side. */
  session_completed: {
    minutes: number;
    points_earned: number;
    xp_earned: number;
    is_verified: boolean;
    /** Since Fase 1: `stopwatch` is a mode, and how much it gets used decides whether the fixed pomodoro stays the default. */
    timer_mode?: string;
  };
  /**
   * [SERVER] Why a session ended without the user finishing it:
   *
   * - `explicit` — the user tapped "discard". Scores nothing.
   * - `abandoned_no_heartbeat` — the heartbeat went quiet past the grace
   *   window and the sweeper closed it. Still scored, credited up to the last
   *   beat. The rate of this is the metric that tells us whether the Fase 1
   *   mobile work (Live Activity / Foreground Service) actually fixed the
   *   "timer dies with the app" bug — watch it fall after that ships.
   * - `implicit_restart` — retired in Fase 1. Starting a second session now
   *   returns 409 instead of silently killing the first. Kept in the union so
   *   historical rows still typecheck.
   */
  session_abandoned: {
    reason: 'explicit' | 'implicit_restart' | 'abandoned_no_heartbeat';
    minutes?: number;
    points_earned?: number;
    xp_earned?: number;
    is_verified?: boolean;
    timer_mode?: string;
  };
  /** [SERVER] Fired from the same code path that mutates `currentStreak`. */
  streak_extended: { days: number };
  /** [SERVER] */
  streak_broken: { previous_days: number };

  // ── Social ───────────────────────────────────────────────────────────────
  /**
   * Defined ahead of the UI: there is no rooms *list/browse* screen yet
   * (today's League→Room migration, ARCHITECTURE.md §4, isn't done). Wire it
   * in when that screen ships — don't invent it now.
   */
  room_viewed: NoExtraProps;
  room_joined: { mode: string };
  /**
   * Só o prazo. `participation_mode` esteve aqui por algumas horas em
   * 04/08/2026 e saiu no mesmo dia, junto com o conceito: **não existe sala de
   * foto e sala de timer.** Existe uma sala, com duas portas, e quem liga o
   * timer aparece estudando para o grupo.
   *
   * Não há o que medir sobre uma escolha que ninguém faz mais. O que passou a
   * valer a pena medir é quanta gente **usa** cada porta — e isso já sai de
   * `session_started` e do post de foto, sem precisar de campo aqui.
   *
   * Continua `room_created` e não `challenge_created` porque o evento marca o
   * momento em que a sala nasce; o desafio nasce junto e não tem instante
   * próprio para registrar.
   */
  room_created: { duration_days: number; max_members: number };
  invite_shared: { room_id: string };
  /** The invite/join preview loaded — denominator for room_joined via invite. */
  invite_opened: { is_member: boolean };

  // ── IA ───────────────────────────────────────────────────────────────────
  /** A capture (audio/document/photo) finished uploading and has a row server-side. */
  lesson_captured: { source: 'audio' | 'document' | 'photo'; seconds?: number };
  /** [SERVER] `processing_seconds` is the patience budget: upload → structured note. */
  lesson_ready: { source: 'audio' | 'document' | 'photo'; processing_seconds: number };
  /** [SERVER] Pairs with lesson_ready — the other half of "did the loop close." */
  lesson_processing_failed: { source: 'audio' | 'document' | 'photo'; reason: string };
  capture_failed: { source: 'audio' | 'document' | 'photo'; reason: string };
  /** Free-text Q&A against a captured lesson. `grounded=false` means the
   *  capture didn't cover the question — a content-gap signal. */
  lesson_asked: { grounded: boolean };
  /** A lesson converted into flashcards or a quiz — did the capture lead anywhere. */
  material_generated: { kind: 'flashcards' | 'quiz' };
  quiz_started: { questions: number };
  quiz_completed: { questions: number; percent: number };
  flashcards_reviewed: { cards: number };
  /** Content churn — deleting a capture is a "this wasn't worth keeping" signal. */
  lesson_deleted: NoExtraProps;

  // ── Monetização (dormente) ──────────────────────────────────────────────
  paywall_viewed: { trigger: 'quota' | 'settings' | 'feature' };
  /**
   * O que o StoreKit devolveu para o aparelho — moeda, valor e id do produto.
   *
   * Existe porque este é o **único elo da cadeia de preço que não se enxerga de
   * fora**. O RevenueCat só diz quais produtos entram na oferta; quem precifica
   * é o StoreKit, dentro do aparelho. Quando a tela mostrou `$99.99` e a folha
   * de compra da Apple cobrou `R$ 129,90`, não havia de onde olhar: nem o
   * painel, nem a API, nem o código respondem o que o SDK recebeu.
   *
   * Sem isto, toda investigação de preço depende de alguém com o telefone na
   * mão descrevendo o que vê.
   */
  paywall_prices_loaded: {
    product_id: string;
    price: number;
    currency: string;
    period: 'monthly' | 'yearly';
  };
  plan_selected: { selected_plan: 'monthly' | 'yearly' };
  /** The user tapped "subscribe" — before the store sheet resolves. */
  purchase_started: { selected_plan: 'monthly' | 'yearly' };
  /** [SERVER] Fired from the RevenueCat webhook (`INITIAL_PURCHASE`), which
   *  is the only authoritative signal that money actually moved. */
  purchase_completed: { selected_plan: 'monthly' | 'yearly' | 'unknown'; store: 'apple' | 'google' | 'unknown' };
  /** Client-only: the store can reject/cancel a purchase without ever
   *  telling the API, so there is no server-side signal to pair with this. */
  purchase_failed: { selected_plan: 'monthly' | 'yearly'; reason: string };
}

export type AnalyticsEventName = keyof AnalyticsEventProps;

/** Each event's full property set: its own properties plus the base set
 *  every event carries. */
export type AnalyticsEvents = {
  [K in AnalyticsEventName]: AnalyticsBaseProperties & AnalyticsEventProps[K];
};

/**
 * Events that must only ever be emitted from `apps/api`. See the file
 * header and docs/prompts/F0-observabilidade-analytics.md §2.
 */
export const SERVER_SOURCED_EVENTS = [
  'session_completed',
  'session_abandoned',
  'streak_extended',
  'streak_broken',
  'lesson_ready',
  'lesson_processing_failed',
  'purchase_completed',
] as const satisfies readonly AnalyticsEventName[];

export type ServerSourcedEvent = (typeof SERVER_SOURCED_EVENTS)[number];

/** Everything the mobile client is allowed to call `track()` with. */
export type ClientSourcedEvent = Exclude<AnalyticsEventName, ServerSourcedEvent>;

/**
 * Funnel grouping, used by docs and by whoever wires up PostHog funnels/
 * insights — not read by any runtime code.
 */
export const EVENT_FUNNELS = {
  ativacao: [
    'login_succeeded',
    'onboarding_started',
    'onboarding_step_completed',
    'onboarding_completed',
    'onboarding_abandoned',
    'exam_track_selected',
    'first_session_started',
    'first_session_completed',
  ],
  habito: [
    'session_started',
    'session_completed',
    'session_abandoned',
    'streak_extended',
    'streak_broken',
  ],
  social: ['room_viewed', 'room_joined', 'room_created', 'invite_shared', 'invite_opened'],
  ia: [
    'lesson_captured',
    'lesson_ready',
    'lesson_processing_failed',
    'capture_failed',
    'lesson_asked',
    'material_generated',
    'quiz_started',
    'quiz_completed',
    'flashcards_reviewed',
    'lesson_deleted',
  ],
  monetizacao: [
    'paywall_viewed',
    'paywall_prices_loaded',
    'plan_selected',
    'purchase_started',
    'purchase_completed',
    'purchase_failed',
  ],
} as const satisfies Record<string, readonly AnalyticsEventName[]>;
