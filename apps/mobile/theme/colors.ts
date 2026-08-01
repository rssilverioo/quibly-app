/**
 * Semantic color tokens.
 *
 * Rule: screens and components NEVER hardcode a hex. They read from here.
 * If a value you need doesn't exist, add it here as a semantic name —
 * don't inline it.
 *
 * The palette is dark-first: Quibly is used at night, and the accent
 * only reads as "live / on air" against a near-black ground.
 *
 * The accent is azure as of 2026-07-31, replacing the lime. Decided by the
 * product owner together with the rabbit banners the blue is sampled from;
 * this supersedes the "lime fica" row in docs/DIRECAO-PRODUTO.md.
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
  /** Disabled/non-text detail. Readable timestamps and metadata use `fgMuted`. */
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

  /** Product deadline. Calm deadlines stay neutral; use this only for urgency. */
  deadline: string;
  /** Low-emphasis background paired with `deadline`. */
  deadlineSoft: string;

  /** Static loading placeholder. */
  skeleton: string;

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
  fgSubtle: '#686874',
  fgOnAccent: '#0A0A0C',

  // Sampled from the rabbit banners (their fills run #4495F3–#549FF4).
  // 6.95:1 against `bg` — above WCAG AAA for text, so it still carries
  // buttons and live states without a second variant.
  accent: '#4C9AFF',
  accentSoft: 'rgba(76,154,255,0.14)',

  live: '#FF4D4D',
  liveSoft: 'rgba(255,77,77,0.16)',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF5A5A',

  deadline: '#FF8C3B',
  deadlineSoft: 'rgba(255,140,59,0.16)',

  skeleton: '#22222B',

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
  fgSubtle: '#8E8E9A',
  fgOnAccent: '#0A0A0C',

  // On light, the bright azure fails contrast as text (2.94:1) — it stays a
  // *fill*, and text-on-light uses the deep variant. #0043BA is the stroke
  // colour of the rabbit line art itself, so the two themes share one origin.
  accent: '#0043BA',
  accentSoft: 'rgba(76,154,255,0.35)',

  live: '#E02424',
  liveSoft: 'rgba(224,36,36,0.10)',

  success: '#137A38',
  warning: '#A55200',
  danger: '#DC2626',

  deadline: '#A84C08',
  deadlineSoft: 'rgba(168,76,8,0.14)',

  skeleton: '#E7E7EB',

  gold: '#E5A100',
  silver: '#8E8E9A',
  bronze: '#A56A34',

  scrim: 'rgba(0,0,0,0.45)',
};

export const palettes: Record<ThemeMode, Palette> = { dark, light };

/**
 * The azure fill is identical in both themes — it's the brand mark.
 * Only *text* on light backgrounds swaps to the deep variant.
 */
export const BRAND_BLUE = '#4C9AFF';

/**
 * Night sky behind the login screen. Intermediate stops only — the ends come
 * from the palette, so the gradient always meets the app it opens into.
 */
export const NIGHT_GRADIENT = ['#0D1220', '#121A2C', '#182540'] as const;
