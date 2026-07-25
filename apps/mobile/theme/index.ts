/**
 * Quibly design system.
 *
 *   import { useTheme, type, space, radius, motion } from '../theme';
 *   const { c } = useTheme();
 *   <View style={{ backgroundColor: c.surface }} />
 *
 * Dark is the default and the designed-for mode. Light exists so the app
 * doesn't burn people who keep their phone in light mode, but every layout
 * decision is made against dark first.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, type Palette, type ThemeMode } from './colors';

export { text, space, radius, motion, PRESS_SCALE, SUBJECT_COLORS } from './tokens';
export { BRAND_LIME, NIGHT_GRADIENT, type Palette, type ThemeMode } from './colors';

const STORAGE_KEY = '@quibly/theme-mode';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Called once at boot to restore the user's choice */
  hydrate: () => Promise<void>;
}

const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') set({ mode: stored });
    } catch {}
  },
}));

export interface Theme {
  mode: ThemeMode;
  /** Colors. Named `c` because it appears on nearly every style line. */
  c: Palette;
  setMode: (mode: ThemeMode) => void;
}

export function useTheme(): Theme {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return { mode, c: palettes[mode], setMode };
}

/** For use outside React (navigation options, imperative code). */
export function getTheme(): Palette {
  return palettes[useThemeStore.getState().mode];
}

/**
 * The dark palette as a plain object, for `StyleSheet.create` — which runs at
 * module scope and so can't call a hook.
 *
 * Screens using this render correctly but don't re-render on a theme switch.
 * That's the accepted trade for the large legacy screens; anything rebuilt
 * from scratch uses `useTheme()` instead.
 */
export const staticDark: Palette = palettes.dark;

/**
 * Drop-in replacement for the light `COLORS` object in `@quibly/shared`.
 *
 * Screens that still read `COLORS.text` and friends only need their import
 * swapped — no other edit — and they land on the dark palette. The shared
 * constant stays untouched because it's a cross-package export.
 *
 * `primary` maps to the lime accent, so anything painting text with
 * `COLORS.text` on a `COLORS.primary` fill needs `fgOnAccent` instead. Those
 * pairings were audited when this was introduced.
 */
export const legacyColors = {
  background: palettes.dark.bg,
  surface: palettes.dark.surface,
  surfaceLight: palettes.dark.surfaceRaised,
  border: palettes.dark.border,
  primary: palettes.dark.accent,
  primaryLight: palettes.dark.accent,
  secondary: palettes.dark.success,
  accent: palettes.dark.danger,
  warning: palettes.dark.warning,
  success: palettes.dark.success,
  error: palettes.dark.danger,
  text: palettes.dark.fg,
  textSecondary: palettes.dark.fgMuted,
  textMuted: palettes.dark.fgSubtle,
  /** Text placed on a `primary` fill. Absent from the shared object. */
  onPrimary: palettes.dark.fgOnAccent,
  gold: palettes.dark.gold,
  silver: palettes.dark.silver,
  bronze: palettes.dark.bronze,
} as const;

export const hydrateTheme = () => useThemeStore.getState().hydrate();
