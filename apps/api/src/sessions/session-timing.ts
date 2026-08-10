/**
 * Pure time arithmetic for study sessions. No Prisma, no Nest, no clock of its
 * own — every instant comes in as an argument. This is where the server stops
 * trusting the client about how long someone studied, so it is the part that
 * has to be testable without a database.
 *
 * See docs/API-SESSIONS.md for the contract these numbers back.
 */

/**
 * The client is expected to beat every 30s. Anything under a minute would make
 * one dropped request look like an abandoned session.
 */
export const HEARTBEAT_INTERVAL_SECONDS = 30;

/**
 * How long a live session may go without a heartbeat before the sweeper calls
 * it abandoned.
 *
 * Five minutes = ten missed beats. Deliberately generous: mobile networks drop,
 * iOS suspends background work aggressively, and Android dozes. The cost of
 * being *too* generous is bounded — a swept session is credited only up to its
 * last heartbeat, never up to the sweep — so a long window costs nothing but a
 * delay in marking the row. The cost of being too tight is the opposite: real
 * study time silently thrown away. Asymmetric risk, so err long.
 */
export const HEARTBEAT_GRACE_SECONDS = 5 * 60;

/**
 * Ceiling on credited study time per user per calendar day.
 *
 * 16h is not a measurement — this codebase has no production data to fit it to
 * (see docs/API-SESSIONS.md §5, "o número que falta"). It is a deliberately
 * loose sanity bound: above the ~12–14h that the heaviest real YPT users log,
 * below the 24h that a scripted heartbeat loop would produce. It exists to
 * make forgery non-trivial and to leave a trail, not to police anyone.
 *
 * It is overridable per plan through `EntitlementsService` (key
 * `daily_study_minutes_cap`), so tightening it once real data exists is a DB
 * write, not a deploy.
 */
export const DEFAULT_DAILY_STUDY_MINUTES_CAP = 16 * 60;

export type SessionAnomalyKind =
  /** A start was refused because the user already had a live session. */
  | 'overlap_rejected'
  /** The daily cap clipped how much of a session got credited. */
  | 'daily_cap_clipped'
  /** A session ran past the cap on its own — one sitting, not a day's worth. */
  | 'implausible_duration'
  /** A live session went quiet past the grace window and was swept. */
  | 'heartbeat_gap';

export interface PauseInterval {
  startedAt: Date;
  /** `null` while the pause is still open. */
  endedAt: Date | null;
}

/**
 * Milliseconds of `[from, to]` that fall inside a pause.
 *
 * An open pause (`endedAt === null`) is treated as running until `to`, which is
 * what makes "swept while paused" come out right: `to` is the last heartbeat,
 * so the pause is clipped there rather than to the sweep time.
 *
 * Intervals are clamped to the window and to non-negative length, so a clock
 * skew or an out-of-order write can never *add* time.
 */
export function pausedMillisWithin(
  pauses: readonly PauseInterval[],
  from: Date,
  to: Date,
): number {
  const windowStart = from.getTime();
  const windowEnd = to.getTime();
  if (windowEnd <= windowStart) return 0;

  let total = 0;
  for (const pause of pauses) {
    const start = Math.max(pause.startedAt.getTime(), windowStart);
    const end = Math.min((pause.endedAt ?? to).getTime(), windowEnd);
    if (end > start) total += end - start;
  }
  // Overlapping pause rows would double-count. They cannot happen through the
  // API (pause is rejected unless the session is `active`), but a clamp here is
  // cheaper than trusting that forever.
  return Math.min(total, windowEnd - windowStart);
}

/**
 * Seconds a session actually ran: wall clock from start to end, minus pauses.
 * Never negative.
 */
export function measuredSeconds(
  startedAt: Date,
  endedAt: Date,
  pauses: readonly PauseInterval[],
): number {
  const gross = endedAt.getTime() - startedAt.getTime();
  if (gross <= 0) return 0;
  const net = gross - pausedMillisWithin(pauses, startedAt, endedAt);
  return Math.max(0, Math.floor(net / 1000));
}

export interface CreditedDuration {
  /** What the session actually ran, before the cap. */
  measuredSeconds: number;
  /** What gets written to `totalDurationMinutes`, two decimals. */
  creditedMinutes: number;
  /** True when the daily cap, not the user, decided the number. */
  clippedByDailyCap: boolean;
}

/**
 * Turn measured seconds into credited minutes, applying the per-day ceiling.
 *
 * `alreadyCreditedMinutesToday` is the sum this user has already banked today;
 * a session that would push the day past `dailyCapMinutes` is credited only up
 * to the remainder. The overflow is not queued or refunded — it is dropped, and
 * the caller records a `daily_cap_clipped` anomaly.
 */
export function creditedDuration(
  measured: number,
  alreadyCreditedMinutesToday: number,
  dailyCapMinutes: number,
): CreditedDuration {
  const rawMinutes = measured / 60;
  if (!Number.isFinite(dailyCapMinutes)) {
    return {
      measuredSeconds: measured,
      creditedMinutes: round2(rawMinutes),
      clippedByDailyCap: false,
    };
  }

  const remaining = Math.max(0, dailyCapMinutes - alreadyCreditedMinutesToday);
  const credited = Math.min(rawMinutes, remaining);
  return {
    measuredSeconds: measured,
    creditedMinutes: round2(credited),
    // Only a *reduction* counts as clipping. A session that fits exactly is not
    // clipped, and neither is a zero-length one.
    clippedByDailyCap: credited < rawMinutes - 1e-9,
  };
}

/**
 * How many pomodoro cycles the session earned — derived, never reported.
 *
 * This used to arrive in the request body alongside the duration, which made it
 * the second client-controlled input into `calculateScore` (it drives both the
 * participation SP and the per-cycle bonus). The formula in
 * `packages/shared/src/scoring.ts` is untouched; only where this number comes
 * from changed.
 *
 * `stopwatch` and `audio` have no target duration, so they earn no cycles.
 */
export function completedCycles(
  timerMode: string,
  creditedMinutes: number,
  workDurationMinutes: number,
): number {
  if (timerMode === 'stopwatch' || timerMode === 'audio') return 0;
  if (workDurationMinutes <= 0) return 0;
  return Math.floor(creditedMinutes / workDurationMinutes);
}

/**
 * Whether the user bailed before finishing a single planned work block.
 *
 * Only `hardcore` leagues penalise this. The old definition compared the
 * client's minutes against `workDuration × client's cycle count`, which is
 * circular once cycles are derived from minutes — it would never fire. This is
 * the server-side reading of the same intent: you did not complete one block.
 *
 * A `stopwatch` session has no block to fall short of, so it never ends early.
 */
export function endedEarly(
  timerMode: string,
  creditedMinutes: number,
  workDurationMinutes: number,
): boolean {
  if (timerMode === 'stopwatch' || timerMode === 'audio') return false;
  if (workDurationMinutes <= 0) return false;
  return creditedMinutes < workDurationMinutes;
}

/**
 * The instant a live session should be credited up to, given it went quiet.
 * A session that never beat at all is credited up to its start — zero minutes —
 * rather than up to the sweep, which is the whole point of the heartbeat.
 */
export function sweepCreditInstant(
  startedAt: Date,
  lastHeartbeatAt: Date | null,
): Date {
  if (!lastHeartbeatAt) return startedAt;
  return lastHeartbeatAt.getTime() > startedAt.getTime() ? lastHeartbeatAt : startedAt;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Quanto tempo uma sessão pode ficar **calada** antes de ser varrida.
 *
 * ## O problema que isto resolve
 *
 * O dono do produto, em 10/08: "a pessoa pode pôr o telefone em modo avião".
 * E deve poder — quem desliga a internet para estudar é exatamente a pessoa que
 * este produto quer. Hoje ela perde a sessão em cinco minutos.
 *
 * ## Por que cinco minutos não podia ser simplesmente aumentado
 *
 * A varredura não é contagem, é controle de fraude. Ela credita só até
 * `lastHeartbeatAt` (ver `sweepCreditInstant`), então deixar a sessão aberta
 * por mais tempo **não credita nada a mais sozinho**. O risco é outro: uma
 * sessão que continua aberta pode ser retomada depois, e aí o crédito final vai
 * de `startedAt` até o fim — incluindo horas em que ninguém estudou.
 *
 * Uma janela fixa e generosa compraria offline ao preço de tempo ocioso
 * creditável, para todo mundo, o tempo todo.
 *
 * ## A régua: o plano da própria sessão
 *
 * Um pomodoro declara quanto vai durar **antes de começar** — `workDuration` e
 * `breakDuration` são escolhidos na tela de preparo, e ficam gravados na linha.
 * Esse plano é a justificativa natural para o silêncio: enquanto a sessão está
 * dentro do que ela mesma prometeu, ficar calada é esperado; passou disso, é
 * zumbi.
 *
 * O ponto que torna isto seguro é a ordem. O plano é declarado antes do período
 * offline, não depois — então não dá para, já desconectado, decidir que a
 * sessão "ia durar" três horas.
 *
 * `CICLOS_PLANEJADOS` espelha `TOTAL_CYCLES` de `app/session/active.tsx`. Quatro
 * ciclos é o pomodoro clássico, e é o que a tela roda.
 *
 * ## O cronômetro livre não tem plano
 *
 * `stopwatch` é aberto por definição: não há duração declarada para servir de
 * régua, e conceder a janela longa a ele seria conceder a qualquer sessão, já
 * que o modo é escolha de um toque. Fica com a janela curta.
 *
 * O custo é assumido: cronômetro livre em modo avião ainda perde a sessão. A
 * alternativa seria o cliente provar continuidade com um registro de batimentos
 * — o que é a evolução natural disto, e não cabia neste passo.
 */
export const CICLOS_PLANEJADOS = 4;

/** Folga sobre o plano, para a sessão não morrer no minuto exato do fim. */
const FOLGA_SOBRE_O_PLANO_SEGUNDOS = 5 * 60;

export interface PlanoDaSessao {
  timerMode: string;
  workDuration: number;
  breakDuration: number;
  startedAt: Date;
}

/**
 * O instante a partir do qual esta sessão pode ser varrida por silêncio.
 *
 * Devolve o **maior** entre a janela curta de sempre e o fim do plano — nunca
 * encurta o que já existia.
 */
export function silencioToleradoAte(
  sessao: PlanoDaSessao,
  ultimoBatimento: Date | null,
): Date {
  const base = ultimoBatimento ?? sessao.startedAt;
  const janelaCurta = new Date(base.getTime() + HEARTBEAT_GRACE_SECONDS * 1000);

  if (sessao.timerMode !== 'pomodoro') return janelaCurta;

  const planoSegundos =
    CICLOS_PLANEJADOS * (sessao.workDuration + sessao.breakDuration) * 60;
  const fimDoPlano = new Date(
    sessao.startedAt.getTime() +
      (planoSegundos + FOLGA_SOBRE_O_PLANO_SEGUNDOS) * 1000,
  );

  return fimDoPlano > janelaCurta ? fimDoPlano : janelaCurta;
}

/**
 * Quanto para trás o servidor aceita que uma sessão tenha começado.
 *
 * ## O que isto abre, e por quê
 *
 * `StartSessionDto` diz, em comentário, que não existe timestamp de início no
 * pedido: "o servidor carimba `startedAt` ele mesmo". Essa invariante é o que
 * impede alguém de reivindicar tempo que não estudou, e ela está sendo aberta
 * **de propósito**, com o dono do produto ciente, para o caso do modo avião:
 * quem liga o avião antes de sentar não conseguia nem começar.
 *
 * ## O limite é o plano, e o plano é declarado antes
 *
 * A sessão nascida offline chega com um início declarado pelo aparelho. Ele é
 * **cortado** ao que o plano dela justifica: um pomodoro de 4x(25+5) pode
 * afirmar no máximo 125 minutos para trás; um de 4x(50+10), 245.
 *
 * Assim o pior caso deixa de ser "reivindico as três horas em que fui almoçar"
 * e passa a ser "reivindico uma sessão planejada". Somado ao teto diário, a
 * fraude possível é de uma sessão, não de um dia.
 *
 * ## Nunca para o futuro
 *
 * Um relógio adiantado no aparelho mandaria um início à frente do servidor, e
 * a sessão nasceria com duração negativa — ou, pior, contando para trás. `now`
 * é o piso superior, sempre.
 *
 * ## Sem dica, agora
 *
 * O caminho normal (sessão criada com rede) não manda nada, e continua sendo o
 * servidor quem carimba. Esta função só existe para o outro caminho.
 */
export function inicioAceitavel(
  dica: Date | null,
  now: Date,
  sessao: Pick<PlanoDaSessao, 'timerMode' | 'workDuration' | 'breakDuration'>,
): Date {
  if (!dica) return now;
  if (dica >= now) return now;

  const planoSegundos =
    sessao.timerMode === 'pomodoro'
      ? CICLOS_PLANEJADOS * (sessao.workDuration + sessao.breakDuration) * 60 +
        FOLGA_SOBRE_O_PLANO_SEGUNDOS
      : /*
         Cronômetro livre não tem plano, então não tem justificativa própria
         para retroagir. Fica com a janela curta — o suficiente para cobrir o
         tempo entre começar e a rede voltar num caso normal, e pouco demais
         para valer a pena forjar.
        */
        HEARTBEAT_GRACE_SECONDS;

  const maisAntigoAceitavel = new Date(now.getTime() - planoSegundos * 1000);
  return dica > maisAntigoAceitavel ? dica : maisAntigoAceitavel;
}

/**
 * A prova de continuidade cobre o intervalo em que o servidor não ouviu nada?
 *
 * O app grava um instante por batida mesmo sem rede (`lib/sessao-em-cache.ts`)
 * e manda o registro na reconexão. Aqui se decide se aquele silêncio conta como
 * estudo ou é descartado.
 *
 * ## O que se exige
 *
 * Que as batidas **cubram** o intervalo sem buraco maior que a tolerância. Uma
 * lista com duas pontas e nada no meio prova que o app estava vivo em dois
 * instantes, não que esteve vivo o tempo todo — e é exatamente essa a diferença
 * entre quem estudou e quem fechou o app e voltou depois.
 *
 * ## O que não se exige
 *
 * Que os instantes sejam verdadeiros. Eles vêm do relógio do aparelho, que a
 * pessoa mexe nos Ajustes. Não importa: o intervalo `[de, ate]` é medido pelo
 * **servidor**, e a prova só pode preenchê-lo, nunca esticá-lo. O teto do que
 * se pode afirmar é o tempo que de fato passou.
 *
 * A tolerância é o dobro do intervalo de batida: uma batida perdida é normal
 * (o app dorme, o iOS suspende), duas seguidas já é ausência.
 */
export function provaCobreOSilencio(
  batidas: readonly number[],
  de: Date,
  ate: Date,
  toleranciaSegundos = HEARTBEAT_INTERVAL_SECONDS * 2,
): boolean {
  const inicio = de.getTime();
  const fim = ate.getTime();
  if (fim <= inicio) return true;

  const toleranciaMs = toleranciaSegundos * 1000;
  const dentro = batidas
    .filter((b) => Number.isFinite(b) && b > inicio && b <= fim)
    .sort((a, b) => a - b);

  let cursor = inicio;
  for (const batida of dentro) {
    if (batida - cursor > toleranciaMs) return false;
    cursor = batida;
  }
  return fim - cursor <= toleranciaMs;
}
