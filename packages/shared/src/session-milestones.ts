/**
 * Como o Castelo evolui ao longo de uma sessão de estudo.
 *
 * ## A ideia
 *
 * O mascote já tem 30 estados desenhados (`assets/mascot/INDEX.md`) e quase
 * todos estão parados. Amarrar uma escada deles ao tempo decorrido transforma o
 * cronômetro numa coisa que **muda enquanto você olha** — e dá motivo para
 * manter a Live Activity na tela de bloqueio em vez de dispensá-la.
 *
 * É também o tipo de detalhe que o YPT não tem: lá o número sobe e pronto.
 *
 * ## Por que fica aqui, e não na tela
 *
 * Três lugares precisam concordar sobre o que significa "estudou 47 minutos":
 * a tela da sessão, o widget da Live Activity e — na Fase 2 — o ranking da
 * sala, onde o marco de cada pessoa aparece ao lado do nome. Uma escada
 * duplicada em três lugares diverge no primeiro ajuste.
 *
 * O widget iOS é Swift e não consegue importar daqui; a cópia dele em
 * `StudyTimerLiveActivity.swift` aponta para este arquivo como fonte da verdade.
 *
 * ## O formato da escada
 *
 * Densa no começo, esparsa depois. Os primeiros 45 minutos mudam a cada 15,
 * porque é aí que a pessoa ainda está decidindo se continua — é quando um sinal
 * de progresso vale mais. Depois de uma hora, quem está estudando já está
 * estudando, e mudar de estado a toda hora viraria ruído.
 */

/** Um dos estados de mascote de `apps/mobile/components/mascot/Mascot.tsx`. */
export type MascotState =
  | 'focused' | 'reading' | 'working' | 'cool'
  | 'streak' | 'star' | 'medal' | 'crowned'
  | 'break' | 'sleepy';

export interface SessionMilestone {
  /** A partir de quantos minutos este marco vale. */
  fromMinutes: number;
  mascot: MascotState;
  /** Chave de i18n, resolvida nos arquivos `session.json` de cada locale. */
  labelKey: string;
}

/**
 * Do mais longo para o mais curto — `milestoneForMinutes` pega o primeiro que
 * couber, então a ordem aqui é o algoritmo.
 */
export const SESSION_MILESTONES: readonly SessionMilestone[] = [
  { fromMinutes: 180, mascot: 'crowned', labelKey: 'milestone.crowned' },
  { fromMinutes: 120, mascot: 'medal',   labelKey: 'milestone.medal' },
  { fromMinutes: 90,  mascot: 'star',    labelKey: 'milestone.star' },
  { fromMinutes: 60,  mascot: 'streak',  labelKey: 'milestone.streak' },
  { fromMinutes: 45,  mascot: 'cool',    labelKey: 'milestone.cool' },
  { fromMinutes: 30,  mascot: 'working', labelKey: 'milestone.working' },
  { fromMinutes: 15,  mascot: 'reading', labelKey: 'milestone.reading' },
  { fromMinutes: 0,   mascot: 'focused', labelKey: 'milestone.focused' },
] as const;

/**
 * Normaliza a entrada. Só `NaN` vira zero — `Infinity` passa direto, porque
 * uma sessão infinitamente longa certamente cruzou o topo da escada, e
 * rebaixá-la para `focused` seria o contrário do que o número diz.
 */
function safeMinutes(minutes: number): number {
  if (Number.isNaN(minutes)) return 0;
  return Math.max(0, minutes);
}

/** O marco correspondente a um tempo decorrido. Nunca retorna `undefined`. */
export function milestoneForMinutes(minutes: number): SessionMilestone {
  const safe = safeMinutes(minutes);
  // O último elemento tem `fromMinutes: 0`, então o find sempre acha algo.
  return SESSION_MILESTONES.find((m) => safe >= m.fromMinutes)!;
}

/**
 * O mascote a mostrar, considerando também se a sessão está pausada.
 *
 * Pausa vence o marco: alguém em intervalo depois de duas horas deve parecer
 * em intervalo, não coroado. O estado de conquista volta quando a sessão volta.
 */
export function mascotForSession(minutes: number, isRunning: boolean): MascotState {
  if (!isRunning) return 'break';
  return milestoneForMinutes(minutes).mascot;
}

/**
 * Quanto falta para o próximo marco, em minutos, ou `null` no topo da escada.
 *
 * Serve para a tela dizer "faltam 13 min para o próximo" — um empurrão barato
 * exatamente no momento em que alguém pensa em parar.
 */
export function minutesToNextMilestone(minutes: number): number | null {
  const safe = safeMinutes(minutes);
  // A lista é decrescente; o próximo marco é o menor `fromMinutes` acima do
  // tempo atual, ou seja, o último da lista que ainda é maior.
  const upcoming = [...SESSION_MILESTONES]
    .reverse()
    .find((m) => m.fromMinutes > safe);
  return upcoming ? upcoming.fromMinutes - safe : null;
}
