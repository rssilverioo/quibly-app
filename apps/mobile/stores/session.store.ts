import { create } from 'zustand';
import type { TimerMode, StudySession } from '@quibly/shared';
import i18n from '../lib/i18n';
import { TIMER_PRESETS } from '@quibly/shared/constants';
import * as sessionsService from '../services/sessions';
import type { LiveSession } from '../services/sessions';
import { HeartbeatController } from '../lib/heartbeat';
import {
  startLiveTimer,
  updateLiveTimer,
  stopLiveTimer,
  setLiveActionContext,
  clearLiveActionContext,
} from '../services/study-timer';
import {
  schedulePhaseEndNotification,
  cancelSessionNotifications,
} from '../lib/notifications';

/**
 * Session state, rebuilt around the Fase 1 contract (docs/API-SESSIONS.md).
 *
 * ## The one idea that shapes this file
 *
 * The server owns the clock. This store holds the **last elapsed count the
 * server reported** plus **when it arrived**, and derives what the UI shows by
 * interpolating between beats. A local tick is a smoothing device, never an
 * accumulator — every 30s the heartbeat lands and the interpolation is thrown
 * away and replaced with truth.
 *
 * That is what kills the old failure mode. Before, `elapsedSeconds` was a
 * counter incremented by a `setInterval`; if the app was killed the count died
 * with it, and if the app was tampered with the count was whatever the client
 * said. Now, killing the app loses nothing (the server keeps measuring, and the
 * sweeper credits up to the last beat) and tampering achieves nothing.
 *
 * ## Breaks are pauses
 *
 * A pomodoro break is a server-side pause. The server has no concept of
 * "break", but it does have pause intervals that it excludes from the credited
 * duration — which is exactly the right semantics, because break time is not
 * study time. So `startBreak()` pauses on the server and `startWork()` resumes.
 */

/** Phases are a client-side UX concept; the server only sees active/paused. */
type Phase = 'work' | 'break';

/**
 * O bloco atual, no formato que a Live Activity precisa.
 *
 * Existe para as duas superfícies mostrarem **o mesmo número**. A tela conta
 * para baixo dentro do bloco de pomodoro; a Live Activity contava para cima na
 * sessão inteira, e as duas se contradiziam lado a lado.
 *
 * No cronômetro livre não há bloco: devolve zeros, e o widget volta a contar
 * para cima — que ali é a única leitura possível.
 */
function faseParaOWidget(estado: {
  timerMode: TimerMode;
  phase: Phase;
  phaseElapsedSeconds: number;
  workDuration: number;
  breakDuration: number;
}) {
  if (estado.timerMode === 'stopwatch') {
    return { remainingSeconds: 0, totalSeconds: 0, label: '' };
  }

  const totalSeconds = (estado.phase === 'work' ? estado.workDuration : estado.breakDuration) * 60;
  return {
    remainingSeconds: Math.max(0, totalSeconds - estado.phaseElapsedSeconds),
    totalSeconds,
    // Traduzido aqui: a extensão de widget não carrega i18n, e mandar a chave
    // faria a chave aparecer na tela de bloqueio.
    label: i18n.t(estado.phase === 'work' ? 'session:active.work' : 'session:active.break'),
  };
}


interface SessionState {
  currentSession: StudySession | null;
  timerMode: TimerMode;
  workDuration: number;
  breakDuration: number;

  /** Last elapsed count reported by the server, in seconds. Net of pauses. */
  serverElapsedSeconds: number;
  /** `Date.now()` when `serverElapsedSeconds` arrived. Null before the first beat. */
  serverSyncedAt: number | null;
  /** Local monotonic seconds within the current phase, for the countdown ring. */
  phaseElapsedSeconds: number;

  isRunning: boolean;
  phase: Phase;
  pomodorosCompleted: number;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  leagueId: string | null;
  userId: string | null;
  streakDays: number;
  isPaused: boolean;
  /**
   * Beats have been failing for longer than the grace window. The session is
   * presumed swept server-side; the UI must stop pretending it is running.
   */
  isDisconnected: boolean;
  /** Set by session/setup.tsx before startSession(). */
  isFirstSession: boolean;

  setTimerMode: (mode: TimerMode) => void;
  setWorkDuration: (minutes: number) => void;
  setBreakDuration: (minutes: number) => void;
  /** Atalho de duração: aplica um preset de uma vez só. Ver `setTimerMode`. */
  applyTimerPreset: (preset: keyof typeof TIMER_PRESETS) => void;
  setSubjectId: (id: string) => void;
  setSubjectName: (name: string) => void;
  setSubjectColor: (color: string) => void;
  setLeagueId: (id: string | null) => void;
  setUserId: (id: string) => void;
  setStreakDays: (days: number) => void;
  setIsFirstSession: (value: boolean) => void;

  startSession: () => Promise<void>;
  /** Adopt a session the server says is already live — app relaunch, or a 409. */
  adoptSession: (session: LiveSession) => void;
  /** Ask the server what is live and adopt it. Returns whether one was found. */
  restoreFromServer: () => Promise<boolean>;
  endSession: () => Promise<{
    durationMinutes: number;
    pomodorosCompleted: number;
    pointsEarned: number;
    xpEarned: number;
    score?: Record<string, number>;
    previousLevel?: number;
    newLevel?: number;
    isFirstSession: boolean;
  }>;

  /** Seconds the UI should display: server truth plus time since it arrived. */
  displayedElapsedSeconds: () => number;
  /** Local tick, for the countdown ring only. Does not touch credited time. */
  tick: () => void;
  /** Force a beat now — call when the app returns to the foreground. */
  syncNow: () => Promise<void>;

  pause: () => Promise<void>;
  resume: () => Promise<void>;
  startBreak: () => Promise<void>;
  startWork: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  currentSession: null,
  timerMode: 'pomodoro' as TimerMode,
  workDuration: TIMER_PRESETS.pomodoro.work,
  breakDuration: TIMER_PRESETS.pomodoro.break,
  serverElapsedSeconds: 0,
  serverSyncedAt: null,
  phaseElapsedSeconds: 0,
  isRunning: false,
  phase: 'work' as const,
  pomodorosCompleted: 0,
  subjectId: null,
  subjectName: null,
  subjectColor: null,
  leagueId: null,
  userId: null,
  streakDays: 0,
  isPaused: false,
  isDisconnected: false,
  isFirstSession: false,
};

/**
 * Lives outside the store because it is not state — it is a running process,
 * and putting it in the store would make every beat re-render every subscriber.
 */
let heartbeat: HeartbeatController | null = null;

function stopHeartbeat(): void {
  heartbeat?.stop();
  heartbeat = null;
}

export const useSessionStore = create<SessionState>((set, get) => {
  /** Wire a heartbeat to a live session and start beating. */
  function attachHeartbeat(sessionId: string): void {
    stopHeartbeat();
    heartbeat = new HeartbeatController({
      sessionId,
      send: async (id) => {
        const result = await sessionsService.heartbeat(id);
        return {
          elapsedSeconds: result.elapsed_seconds,
          status: result.status,
          serverTime: result.server_time,
        };
      },
      onTick: (snapshot) => {
        // The reconciliation point. Whatever the local interpolation drifted
        // to is discarded in favour of the number the server measured.
        set({
          serverElapsedSeconds: snapshot.elapsedSeconds,
          serverSyncedAt: Date.now(),
          isDisconnected: false,
        });
        // Push the corrected total to the lock screen too, so the notification
        // and the in-app timer never disagree.
        void updateLiveTimer(
          get().subjectName ?? '',
          snapshot.elapsedSeconds,
          snapshot.status === 'active',
          faseParaOWidget(get()),
        );
      },
      onGraceExpired: () => {
        // Stop the running illusion. The server has swept this session (or is
        // about to), crediting up to the last beat — showing a ticking timer
        // now would be a lie, on screen or on the lock screen.
        set({ isRunning: false, isDisconnected: true });
        cancelSessionNotifications().catch(() => {});
        clearLiveActionContext();
      void stopLiveTimer();
      },
      onSessionGone: () => {
        set({ isRunning: false, isDisconnected: true });
        cancelSessionNotifications().catch(() => {});
        clearLiveActionContext();
      void stopLiveTimer();
      },
    });
    heartbeat.start();
  }

  return {
    ...initialState,

    /**
     * Troca o modo — e **só** o modo.
     *
     * Antes daqui saíam também `workDuration`/`breakDuration`, sobrescritos com
     * o preset sempre que o modo era (re)selecionado. Isso funcionava enquanto
     * `pomodoro` era fixo em 25/5 e a configuração morava num modo à parte
     * (`custom`). Agora o pomodoro é configurável: se este método continuasse
     * aplicando o preset, tocar em "Pomodoro" logo depois de ajustar para 40/8
     * jogaria a escolha do usuário fora. O preset agora só é aplicado quando
     * ele pede — pelos atalhos, via `applyTimerPreset`.
     *
     * Sobre o `TimerMode`: o union ainda tem quatro membros
     * (`pomodoro | deep_focus | custom | stopwatch`) porque o servidor guarda
     * esse valor em sessões que já existem — `deep_focus` e `custom` são
     * **histórico** e continuam entrando por `adoptSession`. A tela é o
     * presente e oferece dois: `pomodoro` e `stopwatch`.
     */
    setTimerMode: (mode: TimerMode) => set({ timerMode: mode }),

    setWorkDuration: (minutes) => set({ workDuration: minutes }),
    setBreakDuration: (minutes) => set({ breakDuration: minutes }),
    applyTimerPreset: (preset) =>
      set({
        workDuration: TIMER_PRESETS[preset].work,
        breakDuration: TIMER_PRESETS[preset].break,
      }),
    setSubjectId: (id) => set({ subjectId: id }),
    setSubjectName: (name) => set({ subjectName: name }),
    setSubjectColor: (color) => set({ subjectColor: color }),
    setLeagueId: (id) => set({ leagueId: id }),
    setUserId: (id) => set({ userId: id }),
    setStreakDays: (days) => set({ streakDays: days }),
    setIsFirstSession: (value) => set({ isFirstSession: value }),

    startSession: async () => {
      const state = get();
      if (!state.subjectId || !state.userId) {
        throw new Error('Subject and user must be set before starting.');
      }

      const session = await sessionsService.startSession({
        subject_id: state.subjectId,
        league_id: state.leagueId ?? undefined,
        timer_mode: state.timerMode,
        work_duration: state.workDuration,
        break_duration: state.breakDuration,
      });

      get().adoptSession(session);

      if (state.timerMode !== 'stopwatch') {
        schedulePhaseEndNotification(state.workDuration * 60, 'work').catch(() => {});
      }
    },

    adoptSession: (session: LiveSession) => {
      const isPaused = session.status === 'paused';
      // `work_duration` e `break_duration` são opcionais no contrato da API —
      // `stopwatch` não tem duração de fase nenhuma, e uma sessão antiga pode
      // ter vindo sem elas. Atribuir direto punha `undefined` num campo
      // `number`, e o timer imprimia `NaN:NaN` ao retomar a sessão; a
      // notificação de fim de fase era agendada para `NaN` segundos junto.
      // O preset do próprio modo é a resposta certa. Para `custom` sem valor,
      // pomodoro é um piso razoável — e qualquer número real é melhor que
      // `NaN`.
      //
      // Este ramo é a porta de entrada do histórico: a tela de setup só produz
      // `pomodoro` e `stopwatch`, mas sessões gravadas antes disso chegam aqui
      // como `deep_focus` ou `custom` e **têm que continuar sendo aceitas**.
      // Não estreite isso para dois modos.
      const preset =
        session.timer_mode === 'deep_focus' ? TIMER_PRESETS.deep_focus : TIMER_PRESETS.pomodoro;
      set({
        currentSession: session,
        // Seed from the server's count, not from zero — on a relaunch this is
        // what puts the three hours already studied back on screen.
        serverElapsedSeconds: session.elapsed_seconds ?? 0,
        serverSyncedAt: Date.now(),
        phaseElapsedSeconds: 0,
        isRunning: !isPaused,
        isPaused,
        isDisconnected: false,
        timerMode: session.timer_mode,
        workDuration: session.work_duration ?? preset.work,
        breakDuration: session.break_duration ?? preset.break,
        subjectId: session.subject_id,
        leagueId: session.league_id,
        phase: 'work',
      });
      attachHeartbeat(session.id);

      // Raise the lock-screen surface: the foreground service on Android (which
      // keeps the process, and therefore the heartbeat, alive) and the Live
      // Activity on iOS (which cannot, and only displays).
      // O token nasce com a sessão e vai para o App Group, onde o App Intent
      // da extensão o encontra. Sem ele os botões caem no deep link.
      setLiveActionContext(
        session.id,
        (session as { live_action_token?: string | null }).live_action_token,
        process.env.EXPO_PUBLIC_API_URL || 'https://api.tryquibly.com',
      );

      void startLiveTimer(
        get().subjectName ?? '',
        session.elapsed_seconds ?? 0,
        !isPaused,
        faseParaOWidget(get()),
      );
    },

    restoreFromServer: async () => {
      const live = await sessionsService.getActiveSession();
      if (!live) return false;
      get().adoptSession(live);
      return true;
    },

    endSession: async () => {
      cancelSessionNotifications().catch(() => {});
      stopHeartbeat();
      clearLiveActionContext();
      void stopLiveTimer();

      const state = get();
      if (!state.currentSession) {
        return {
          durationMinutes: 0,
          pomodorosCompleted: 0,
          pointsEarned: 0,
          xpEarned: 0,
          isFirstSession: state.isFirstSession,
        };
      }

      // No body. The server measures the duration and derives the cycle count.
      const result = await sessionsService.endSession(state.currentSession.id);

      set({ currentSession: null, isRunning: false, isPaused: false, isDisconnected: false });

      const session: any = result.session ?? {};
      const durationMinutes = Number(
        session.total_duration_minutes ?? session.totalDurationMinutes ?? 0,
      );
      const cycles = Number(
        session.pomodoro_cycles_completed ?? session.pomodoroCyclesCompleted ?? 0,
      );

      return {
        // Every number here comes back from the server — the client no longer
        // has an opinion about how long the session was or what it earned.
        durationMinutes,
        pomodorosCompleted: cycles,
        pointsEarned: result.score?.total_sp ?? result.score?.totalSP ?? 0,
        xpEarned: result.score?.xp_earned ?? result.score?.xpEarned ?? 0,
        score: result.score,
        previousLevel: result.previous_level,
        newLevel: result.new_level,
        isFirstSession: state.isFirstSession,
      };
    },

    displayedElapsedSeconds: () => {
      const { serverElapsedSeconds, serverSyncedAt, isRunning } = get();
      if (serverSyncedAt === null) return serverElapsedSeconds;
      // While paused, the server's count is already final — do not interpolate
      // past it, or the display would drift forward during a break.
      if (!isRunning) return serverElapsedSeconds;
      const sinceSync = Math.floor((Date.now() - serverSyncedAt) / 1000);
      return serverElapsedSeconds + Math.max(0, sinceSync);
    },

    tick: () => {
      const state = get();
      if (!state.isRunning) return;
      // Only advances the phase countdown. Credited time is not touched here —
      // that is `displayedElapsedSeconds`, derived from the server.
      set({ phaseElapsedSeconds: state.phaseElapsedSeconds + 1 });
    },

    syncNow: async () => {
      await heartbeat?.beatNow();
    },

    pause: async () => {
      cancelSessionNotifications().catch(() => {});
      const { currentSession } = get();
      // Flip locally first so the UI responds instantly; the request follows.
      set({ isRunning: false, isPaused: true });
      void updateLiveTimer(get().subjectName ?? '', get().serverElapsedSeconds, false, faseParaOWidget(get()));
      if (!currentSession) return;
      try {
        await sessionsService.pauseSession(currentSession.id);
        await heartbeat?.beatNow();
      } catch {
        // A failed pause is not worth blocking the user over. The heartbeat
        // keeps beating, and the server's own count stays authoritative — the
        // worst case is that this interval gets credited as study time.
      }
    },

    resume: async () => {
      const state = get();
      if (state.timerMode !== 'stopwatch') {
        const phaseDuration =
          state.phase === 'work' ? state.workDuration : state.breakDuration;
        const remaining = phaseDuration * 60 - state.phaseElapsedSeconds;
        schedulePhaseEndNotification(remaining, state.phase).catch(() => {});
      }

      set({ isRunning: true, isPaused: false });
      void updateLiveTimer(get().subjectName ?? '', get().serverElapsedSeconds, true, faseParaOWidget(get()));
      if (!state.currentSession) return;
      try {
        await sessionsService.resumeSession(state.currentSession.id);
        await heartbeat?.beatNow();
      } catch {
        // Same reasoning as pause: never block on it.
      }
    },

    startBreak: async () => {
      cancelSessionNotifications().catch(() => {});
      const state = get();
      schedulePhaseEndNotification(state.breakDuration * 60, 'break').catch(() => {});

      set((s) => ({
        phase: 'break',
        phaseElapsedSeconds: 0,
        pomodorosCompleted: s.pomodorosCompleted + 1,
        isRunning: false,
      }));

      // A break is a pause on the server: break time is not study time, and
      // pause intervals are exactly what gets excluded from credited duration.
      if (state.currentSession) {
        try {
          await sessionsService.pauseSession(state.currentSession.id);
          await heartbeat?.beatNow();
        } catch {
          /* non-blocking, as above */
        }
      }
    },

    startWork: async () => {
      cancelSessionNotifications().catch(() => {});
      const state = get();
      schedulePhaseEndNotification(state.workDuration * 60, 'work').catch(() => {});

      set({ phase: 'work', phaseElapsedSeconds: 0, isRunning: true });

      if (state.currentSession) {
        try {
          await sessionsService.resumeSession(state.currentSession.id);
          await heartbeat?.beatNow();
        } catch {
          /* non-blocking, as above */
        }
      }
    },

    reset: () => {
      cancelSessionNotifications().catch(() => {});
      stopHeartbeat();
      clearLiveActionContext();
      void stopLiveTimer();
      set(initialState);
    },
  };
});
