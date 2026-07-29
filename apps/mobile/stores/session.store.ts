import { create } from 'zustand';
import type { TimerMode, StudySession } from '@quibly/shared';
import { TIMER_PRESETS } from '@quibly/shared/constants';
import * as sessionsService from '../services/sessions';
import type { LiveSession } from '../services/sessions';
import { HeartbeatController } from '../lib/heartbeat';
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
      },
      onGraceExpired: () => {
        // Stop the running illusion. The server has swept this session (or is
        // about to), crediting up to the last beat — showing a ticking timer
        // now would be a lie.
        set({ isRunning: false, isDisconnected: true });
        cancelSessionNotifications().catch(() => {});
      },
      onSessionGone: () => {
        set({ isRunning: false, isDisconnected: true });
        cancelSessionNotifications().catch(() => {});
      },
    });
    heartbeat.start();
  }

  return {
    ...initialState,

    setTimerMode: (mode: TimerMode) => {
      if (mode === 'pomodoro') {
        set({
          timerMode: mode,
          workDuration: TIMER_PRESETS.pomodoro.work,
          breakDuration: TIMER_PRESETS.pomodoro.break,
        });
      } else if (mode === 'deep_focus') {
        set({
          timerMode: mode,
          workDuration: TIMER_PRESETS.deep_focus.work,
          breakDuration: TIMER_PRESETS.deep_focus.break,
        });
      } else {
        // `custom` keeps whatever the user picked; `stopwatch` has no target
        // duration at all, so the values are simply never read.
        set({ timerMode: mode });
      }
    },

    setWorkDuration: (minutes) => set({ workDuration: minutes }),
    setBreakDuration: (minutes) => set({ breakDuration: minutes }),
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
        workDuration: session.work_duration,
        breakDuration: session.break_duration,
        subjectId: session.subject_id,
        leagueId: session.league_id,
        phase: 'work',
      });
      attachHeartbeat(session.id);
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
      set(initialState);
    },
  };
});
