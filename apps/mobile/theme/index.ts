/**
 * Design system do Quibly.
 *
 *   import { useTheme, text, space, radius, motion } from '../theme';
 *   const { c } = useTheme();
 *   <View style={{ backgroundColor: c.surface }} />
 *
 * **Claro é o padrão e é o modo projetado.** Decisão do dono do produto em
 * 2026-08-02, registrada em `docs/BRIEFING-NOITE-02-08.md §1`: o alvo é o clone
 * visual claro do GymRats, com o azul do coelho no lugar do vermelho deles.
 * Isso revoga a linha antiga deste cabeçalho ("dark is the default and the
 * designed-for mode") e a de `colors.ts`.
 *
 * O escuro não sumiu: continua completo, coerente e a um toque de distância no
 * perfil. O que mudou é contra o que se desenha — toda decisão de layout,
 * contraste e densidade agora é tomada no claro, e o escuro é verificado
 * depois. Antes era o inverso, e o resultado prático foi que ninguém usava a
 * paleta clara (`MARCA.md §2.5`): dark-first virou dark-only.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, type Palette, type ThemeMode } from './colors';

export { text, space, radius, motion, PRESS_SCALE, SUBJECT_COLORS } from './tokens';
export { BRAND_BLUE, NIGHT_GRADIENT, type Palette, type ThemeMode } from './colors';

const STORAGE_KEY = '@quibly/theme-mode';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Called once at boot to restore the user's choice */
  hydrate: () => Promise<void>;
}

const useThemeStore = create<ThemeState>((set) => ({
  // Quem já escolheu escuro alguma vez continua no escuro: `hydrate()` lê o
  // AsyncStorage depois e sobrepõe este valor. Isto aqui é o padrão de quem
  // abre o app pela primeira vez.
  mode: 'light',
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
 * @deprecated Use `useTheme()`. Esta constante existe só para as telas grandes
 * que ainda montam `StyleSheet.create` no escopo do módulo, onde não dá para
 * chamar hook.
 *
 * **Aponta para a paleta CLARA desde 02/08/2026** — o nome mentiu de propósito
 * por uma noite. Renomear seria uma segunda migração em cima da que ~25
 * arquivos estão fazendo agora; trocar o valor e manter a assinatura foi o
 * único jeito de virar o app sem quebrar três frentes ao mesmo tempo.
 * **Dívida com nome e endereço:** quando o último consumidor sair daqui para
 * `useTheme()`, este export morre junto — ninguém precisa renomear nada.
 *
 * Quem usa isto renderiza certo, mas não re-renderiza na troca de tema. É o
 * preço aceito para a tela legada; o que se reconstrói já nasce em `useTheme()`.
 */
export const staticDark: Palette = palettes.light;

/**
 * @deprecated Use `useTheme()`. Substituto direto do `COLORS` de
 * `@quibly/shared`: a tela que ainda lê `COLORS.text` só troca o import e cai
 * na paleta do tema, sem outra edição. A constante compartilhada fica intocada
 * porque é export entre pacotes.
 *
 * **Aponta para a paleta CLARA desde 02/08/2026**, pelo mesmo motivo do
 * `staticDark` acima. Mesma dívida: some junto com o último consumidor.
 *
 * `primary` é o accent, então texto pintado com `COLORS.text` em cima de um
 * fundo `COLORS.primary` precisa de `onPrimary` — no claro isso agora é branco
 * sobre `#0043BA` (8,4:1), e não mais o near-black que reprovava em 2,1:1.
 */
export const legacyColors = {
  background: palettes.light.bg,
  surface: palettes.light.surface,
  surfaceLight: palettes.light.surfaceRaised,
  border: palettes.light.border,
  primary: palettes.light.accent,
  primaryLight: palettes.light.accent,
  secondary: palettes.light.success,
  accent: palettes.light.danger,
  warning: palettes.light.warning,
  success: palettes.light.success,
  error: palettes.light.danger,
  text: palettes.light.fg,
  textSecondary: palettes.light.fgMuted,
  textMuted: palettes.light.fgSubtle,
  /** Texto em cima de um fundo `primary`. Não existe no objeto compartilhado. */
  onPrimary: palettes.light.fgOnAccent,
  gold: palettes.light.gold,
  silver: palettes.light.silver,
  bronze: palettes.light.bronze,
} as const;

export const hydrateTheme = () => useThemeStore.getState().hydrate();
