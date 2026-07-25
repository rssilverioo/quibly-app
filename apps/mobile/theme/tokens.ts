/**
 * Non-color design tokens: type scale, spacing, radii, motion.
 *
 * These are deliberately short lists. If a screen needs a size that
 * isn't here, the screen is wrong — not the scale.
 */

import { FONTS } from '@quibly/shared/constants';

/**
 * Type scale.
 *
 * Big sizes carry negative tracking — that's most of what separates
 * "modern app" from "default React Native".
 *
 * Named `text`, not `type`: `import { type as t }` collides with
 * TypeScript's inline type-modifier syntax and parses ambiguously.
 */
export const text = {
  /** 64 — the hero number. One per screen, maximum. */
  display: { fontSize: 64, lineHeight: 64, letterSpacing: -2.5, fontFamily: FONTS.bold },
  /** 40 — secondary hero */
  title1: { fontSize: 40, lineHeight: 44, letterSpacing: -1.4, fontFamily: FONTS.bold },
  /** 28 — screen title */
  title2: { fontSize: 28, lineHeight: 34, letterSpacing: -0.8, fontFamily: FONTS.bold },
  /** 20 — section heading */
  title3: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4, fontFamily: FONTS.semiBold },
  /** 16 — body */
  body: { fontSize: 16, lineHeight: 23, letterSpacing: -0.1, fontFamily: FONTS.regular },
  /** 16 semibold — emphasized body, list item titles */
  bodyStrong: { fontSize: 16, lineHeight: 23, letterSpacing: -0.1, fontFamily: FONTS.semiBold },
  /** 14 — secondary text */
  label: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontFamily: FONTS.medium },
  /** 12 — meta, timestamps */
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0, fontFamily: FONTS.medium },
  /** 11 uppercase — eyebrow above a section */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    fontFamily: FONTS.semiBold,
    textTransform: 'uppercase' as const,
  },
} as const;

/** 4-based spacing scale */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/**
 * Motion.
 *
 * Springs, not durations — duration-based easing is what makes an app
 * feel like a website. `snappy` for taps, `soft` for layout, `bouncy`
 * for anything celebratory.
 */
export const motion = {
  snappy: { damping: 20, stiffness: 320, mass: 0.8 },
  soft: { damping: 24, stiffness: 180, mass: 1 },
  bouncy: { damping: 12, stiffness: 220, mass: 0.9 },
  /** Only for opacity fades, where a spring is pointless */
  fade: { duration: 180 },
} as const;

/** Press feedback used across every tappable surface */
export const PRESS_SCALE = 0.97;

/**
 * Colours a user can pick for their own subjects.
 *
 * These are *content*, not chrome — they identify a subject at a glance and
 * so deliberately sit outside the semantic palette. Tuned for legibility on
 * the dark ground.
 */
export const SUBJECT_COLORS = [
  '#C8FF4D', '#4ADE80', '#38BDF8', '#A78BFA', '#F472B6',
  '#FB923C', '#FBBF24', '#2DD4BF', '#F87171', '#818CF8',
] as const;
