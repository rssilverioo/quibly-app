/**
 * Product analytics.
 *
 * This exists to answer one question the app has never been able to answer:
 * where do people fall out between installing and studying a second time.
 *
 * Two sinks, one call site:
 *  - **PostHog** answers product questions — funnels, retention, replay.
 *  - **Firebase / GA4** is the Google side: it feeds Google Ads attribution
 *    and the Firebase console, and it's where install/session data lives.
 *
 * Rules that keep the data usable:
 *  - Events are a closed union. A typo becomes a compile error, not a silent
 *    event nobody notices is missing for three months.
 *  - Names are snake_case, past tense — GA4's convention, and PostHog is happy
 *    with it too, so one name works in both tools.
 *  - No personal data in parameters. Both SDKs already tie events to their own
 *    ids; adding emails or names would only create a privacy liability.
 *  - Every call is fire-and-forget. Analytics must never break a user flow.
 */
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setUserId as setFirebaseUserId,
  setUserProperties as setFirebaseUserProperties,
} from '@react-native-firebase/analytics';
import PostHog from 'posthog-react-native';

/**
 * The funnel, in order, plus the things worth knowing around it.
 * If an event isn't on this list it can't be logged.
 */
export interface AnalyticsEvents {
  // ── activation ──────────────────────────────────────────────────────────
  /** Landed on the login screen. Denominator for everything below. */
  login_viewed: undefined;
  login_succeeded: { method: 'apple' | 'google' };
  onboarding_step_completed: { step: number; total: number };
  onboarding_completed: { education: string; goal: string; subjects: number };
  /** Left onboarding without finishing — the step tells you where. */
  onboarding_abandoned: { step: number };

  // ── the core loop: capture a class ──────────────────────────────────────
  capture_opened: { from: 'lessons' | 'library' | 'empty_state' };
  capture_started: { source: 'audio' | 'document' | 'photo' };
  /** Recording stopped. `seconds` shows whether people record whole classes. */
  capture_recording_stopped: { seconds: number };
  capture_uploaded: { source: 'audio' | 'document' | 'photo'; seconds?: number };
  capture_failed: { source: 'audio' | 'document' | 'photo'; reason: string };

  /** Server finished. `seconds` is wall clock from upload — the patience budget. */
  lesson_ready: { source: 'audio' | 'document' | 'photo'; seconds: number };
  lesson_processing_failed: { source: 'audio' | 'document' | 'photo'; reason: string };
  lesson_opened: { source: 'audio' | 'document' | 'photo' };
  lesson_asked: { grounded: boolean };
  lesson_deleted: undefined;

  // ── did the capture lead anywhere ───────────────────────────────────────
  material_generated: { kind: 'flashcards' | 'quiz' };
  flashcards_completed: { cards: number };
  quiz_completed: { questions: number; percent: number };
  study_session_started: { mode: string; minutes: number };
  study_session_ended: { minutes: number; completed_pomodoros: number };

  // ── retention and money ─────────────────────────────────────────────────
  streak_continued: { days: number };
  streak_broken: { previous_days: number };
  league_joined: undefined;
  league_created: undefined;
  paywall_viewed: { trigger: 'quota' | 'settings' | 'feature' };
  subscription_started: { plan: 'monthly' | 'yearly' };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

/** GA4 truncates string parameters past this. Trim before sending, so both
 *  sinks record the same value rather than silently diverging. */
const MAX_PARAM_CHARS = 100;

let posthog: PostHog | null = null;

/**
 * Called once at boot. Without a key PostHog stays null and every call below
 * quietly degrades to Firebase only — a missing env var must not crash the app.
 */
export function initAnalytics(): void {
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key || posthog) return;

  posthog = new PostHog(key, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    // Screen views are logged explicitly via trackScreen so the two sinks
    // agree on names; autocapture would invent its own.
    captureAppLifecycleEvents: true,
  });

  // Stamped on every event. The project is Quibly's alone, so this is
  // insurance rather than a necessity: if a web app or a second client ever
  // reports into the same project, the mobile events stay separable. Adding
  // it later can't backfill events already collected.
  posthog.register({ app: 'quibly-mobile' });
}

/** Every event parameter is a scalar — both sinks reject nested objects. */
type ParamValue = string | number | boolean;

function sanitise(params: Record<string, unknown>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      out[key] = value.length > MAX_PARAM_CHARS ? value.slice(0, MAX_PARAM_CHARS) : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Log an event to both sinks. Never throws — a failed analytics call must not
 * surface to the user or abort the flow it was measuring.
 */
export function track<E extends AnalyticsEvent>(
  ...args: AnalyticsEvents[E] extends undefined ? [E] : [E, AnalyticsEvents[E]]
): void {
  const [event, raw] = args as [E, Record<string, unknown> | undefined];
  const params = raw ? sanitise(raw) : undefined;

  logEvent(getAnalytics(), event, params).catch(() => {});
  try {
    posthog?.capture(event, params);
  } catch {}
}

/** Screen views, for the funnel between screens rather than within one. */
export function trackScreen(name: string): void {
  logScreenView(getAnalytics(), { screen_name: name, screen_class: name }).catch(() => {});
  try {
    posthog?.screen(name);
  } catch {}
}

/**
 * Ties events to a stable id after sign-in. The Firebase UID is opaque and
 * already stored by Firebase itself — it adds no new personal data.
 */
export function identify(userId: string | null): void {
  setFirebaseUserId(getAnalytics(), userId).catch(() => {});
  try {
    if (userId) posthog?.identify(userId);
    else posthog?.reset();
  } catch {}
}

/**
 * Coarse properties for segmenting the funnel. Deliberately non-identifying:
 * education level and goal, not name or email.
 */
export function setUserProperties(props: {
  plan?: string;
  education_level?: string;
  study_goal?: string;
}): void {
  const clean = Object.fromEntries(
    Object.entries(props).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>;

  setFirebaseUserProperties(getAnalytics(), clean).catch(() => {});
  try {
    posthog?.identify(undefined, clean);
  } catch {}
}
