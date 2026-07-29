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
 * Event names and properties are NOT defined here — they come from
 * `@quibly/shared`'s `analytics-events.ts`, the single canonical taxonomy
 * shared with the API. This file is a thin, typed transport: it injects the
 * required base properties (`country_code`, `exam_track`, `plan`,
 * `app_version`, `platform`) on every call and forwards to both sinks.
 *
 * Rules that keep the data usable:
 *  - `track()` only accepts `ClientSourcedEvent`s — server-sourced events
 *    (session_completed, purchase_completed, lesson_ready, ...) are a
 *    compile error here on purpose. See analytics-events.ts's file header.
 *  - No personal data in parameters. Both SDKs already tie events to their
 *    own ids; adding emails or names would only create a privacy liability.
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
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  AnalyticsBaseProperties,
  AnalyticsEventProps,
  ClientSourcedEvent,
} from '@quibly/shared';
import { UNKNOWN_COUNTRY_CODE, UNKNOWN_EXAM_TRACK } from '@quibly/shared';

/** GA4 truncates string parameters past this. Trim before sending, so both
 *  sinks record the same value rather than silently diverging. */
const MAX_PARAM_CHARS = 100;

let posthog: PostHog | null = null;

/**
 * Mutable context merged into every event. `country_code` and `exam_track`
 * stay `"unknown"` until Fase 1 adds them to the profile (see
 * analytics-events.ts) — `setAnalyticsContext` is where that gets wired up
 * once they exist.
 */
const context: AnalyticsBaseProperties = {
  country_code: UNKNOWN_COUNTRY_CODE,
  exam_track: UNKNOWN_EXAM_TRACK,
  plan: 'FREE',
  app_version: Constants.expoConfig?.version ?? 'unknown',
  platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
};

/**
 * Called from AuthContext whenever the profile loads or changes. Only
 * `plan` has a real value today — `country_code` / `exam_track` are wired
 * here in advance so the call site doesn't need to change again once Fase 1
 * ships `Profile.countryCode` / `Profile.examTrackId`.
 */
export function setAnalyticsContext(next: {
  plan?: AnalyticsBaseProperties['plan'];
  country_code?: string;
  exam_track?: string;
}): void {
  if (next.plan) context.plan = next.plan;
  if (next.country_code) context.country_code = next.country_code;
  if (next.exam_track) context.exam_track = next.exam_track;
}

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

/** An event's own properties — the caller only supplies what's specific to
 *  that event; the base properties are injected automatically. */
type ExtraProps<E extends ClientSourcedEvent> = AnalyticsEventProps[E];

/**
 * Log an event to both sinks. Never throws — a failed analytics call must
 * not surface to the user or abort the flow it was measuring.
 *
 * Only `ClientSourcedEvent`s are accepted — passing a server-sourced event
 * name (e.g. `session_completed`) is a compile error, not a runtime one.
 */
export function track<E extends ClientSourcedEvent>(
  ...args: ExtraProps<E> extends Record<string, never> ? [E] | [E, ExtraProps<E>] : [E, ExtraProps<E>]
): void {
  const [event, extra] = args as [E, Record<string, unknown> | undefined];
  const params = sanitise({ ...context, ...(extra ?? {}) });

  logEvent(getAnalytics(), event, params).catch(() => {});
  try {
    posthog?.capture(event, params);
  } catch {}
}

/** Screen views, for the funnel between screens rather than within one. Kept
 *  separate from the typed event union — a raw screen name is not a
 *  business-question-bearing event, just navigation telemetry. */
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
