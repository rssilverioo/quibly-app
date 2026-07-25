/**
 * Semantic color tokens.
 *
 * Rule: screens and components NEVER hardcode a hex. They read from here.
 * If a value you need doesn't exist, add it here as a semantic name —
 * don't inline it.
 *
 * The palette is dark-first: Quibly is used at night, and the accent
 * only reads as "live / on air" against a near-black ground.
 */

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  /** App background, behind everything */
  bg: string;
  /** Default card / raised block */
  surface: string;
  /** Card sitting on top of another card */
  surfaceRaised: string;
  /** Pressed / hovered surface */
  surfacePressed: string;

  /** Hairline separators and card outlines */
  border: string;
  /** Stronger outline, for focused or selected states */
  borderStrong: string;

  /** Primary text */
  fg: string;
  /** Secondary text, labels */
  fgMuted: string;
  /** Tertiary text, timestamps, disabled */
  fgSubtle: string;
  /** Text placed on top of `accent` */
  fgOnAccent: string;

  /** The single brand accent. Used sparingly — one per screen. */
  accent: string;
  /** Accent at low opacity, for tinted backgrounds */
  accentSoft: string;

  /** Someone is studying right now */
  live: string;
  liveSoft: string;

  success: string;
  warning: string;
  danger: string;

  /** Podium */
  gold: string;
  silver: string;
  bronze: string;

  /** Scrims over photos / modals */
  scrim: string;
}

const dark: Palette = {
  bg: '#0A0A0C',
  surface: '#131318',
  surfaceRaised: '#1C1C23',
  surfacePressed: '#22222B',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  fg: '#F5F5F7',
  fgMuted: '#8E8E9A',
  fgSubtle: '#5C5C68',
  fgOnAccent: '#0A0A0C',

  accent: '#C8FF4D',
  accentSoft: 'rgba(200,255,77,0.14)',

  live: '#FF4D4D',
  liveSoft: 'rgba(255,77,77,0.16)',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF5A5A',

  gold: '#FFC94D',
  silver: '#C4C4CE',
  bronze: '#D08B4F',

  scrim: 'rgba(0,0,0,0.72)',
};

const light: Palette = {
  bg: '#FAFAFB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfacePressed: '#F1F1F4',

  border: 'rgba(10,10,12,0.08)',
  borderStrong: 'rgba(10,10,12,0.16)',

  fg: '#0A0A0C',
  fgMuted: '#6B6B78',
  fgSubtle: '#9A9AA6',
  fgOnAccent: '#0A0A0C',

  // On light, raw lime fails contrast as text — it stays a *fill*,
  // and text-on-light uses the deep variant.
  accent: '#4F7A00',
  accentSoft: 'rgba(200,255,77,0.35)',

  live: '#E02424',
  liveSoft: 'rgba(224,36,36,0.10)',

  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',

  gold: '#E5A100',
  silver: '#8E8E9A',
  bronze: '#A56A34',

  scrim: 'rgba(0,0,0,0.45)',
};

export const palettes: Record<ThemeMode, Palette> = { dark, light };

/**
 * The lime fill is identical in both themes — it's the brand mark.
 * Only *text* on light backgrounds swaps to the deep variant.
 */
export const BRAND_LIME = '#C8FF4D';

/**
 * Night sky behind the login screen. Intermediate stops only — the ends come
 * from the palette, so the gradient always meets the app it opens into.
 */
export const NIGHT_GRADIENT = ['#101018', '#161622', '#1C1C2A'] as const;
