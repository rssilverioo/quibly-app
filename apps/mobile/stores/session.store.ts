import { create } from 'zustand';
import type { TimerMode, StudySession } from '@quibly/shared';
import { TIMER_PRESETS } from '@quibly/shared/constants';
import * as sessionsService from '../services/sessions';
import {
  schedulePhaseEndNotification,
  cancelSessionNotifications,
} from '../lib/notifications';

interface SessionState {
  currentSession: StudySession | null;
  timerMode: TimerMode;
  workDuration: number;
  breakDuration: number;
  elapsedSeconds: number;
  totalWorkSeconds: number;
  isRunning: boolean;
  phase: 'work' | 'break';
  pomodorosCompleted: number;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  leagueId: string | null;
  userId: string | null;
  streakDays: number;
  isPaused: boolean;

  setTimerMode: (mode: TimerMode) => void;
  setWorkDuration: (minutes: number) => void;
  setBreakDuration: (minutes: number) => void;
  setSubjectId: (id: string) => void;
  setSubjectName: (name: string) => void;
  setSubjectColor: (color: string) => void;
  setLeagueId: (id: string | null) => void;
  setUserId: (id: string) => void;
  setStreakDays: (days: number) => void;
  startSession: () => Promise<void>;
  endSession: () => Promise<{
    durationMinutes: number;
    pomodorosCompleted: number;
    pointsEarned: number;
    xpEarned: number;
    score?: Record<string, number>;
    previousLevel?: number;
    newLevel?: number;
  }>;
  tick: () => void;
  /** Catch the timer up after the app was backgrounded. */
  fastForward: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  startBreak: () => void;
  startWork: () => void;
  reset: () => void;
}

const initialState = {
  currentSession: null,
  timerMode: 'pomodoro' as TimerMode,
  workDuration: TIMER_PRESETS.pomodoro.work,
  breakDuration: TIMER_PRESETS.pomodoro.break,
  elapsedSeconds: 0,
  totalWorkSeconds: 0,
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
};

export const useSessionStore = create<SessionState>((set, get) => ({
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

  startSession: async () => {
    const state = get();
    if (!state.subjectId || !state.userId) {
      throw new Error('Subject and user must be set before starting.');
    }

    const session = await sessionsService.startSession({
      user_id: state.userId,
      subject_id: state.subjectId,
      league_id: state.leagueId ?? undefined,
      timer_mode: state.timerMode,
      work_duration: state.workDuration,
      break_duration: state.breakDuration,
    });

    set({
      currentSession: session,
      isRunning: true,
      elapsedSeconds: 0,
      totalWorkSeconds: 0,
      phase: 'work',
      pomodorosCompleted: 0,
    });

    schedulePhaseEndNotification(state.workDuration * 60, 'work').catch(() => {});
  },

  endSession: async () => {
    cancelSessionNotifications().catch(() => {});
    const state = get();
    if (!state.currentSession || !state.userId) {
      return {
        durationMinutes: 0,
        pomodorosCompleted: 0,
        pointsEarned: 0,
        xpEarned: 0,
      };
    }

    const totalMinutes = Math.floor(state.totalWorkSeconds / 60);

    const result = await sessionsService.endSession(state.currentSession.id, {
      pomodoro_cycles_completed: state.pomodorosCompleted,
      total_duration_minutes: totalMinutes,
    });

    set({ currentSession: null, isRunning: false, isPaused: false });

    return {
      durationMinutes: totalMinutes,
      pomodorosCompleted: state.pomodorosCompleted,
      pointsEarned: result.score?.total_sp ?? result.score?.totalSP ?? 0,
      xpEarned: result.score?.xp_earned ?? result.score?.xpEarned ?? 0,
      score: result.score,
      previousLevel: result.previous_level,
      newLevel: result.new_level,
    };
  },

  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    set({
      elapsedSeconds: state.elapsedSeconds + 1,
      totalWorkSeconds:
        state.phase === 'work' ? state.totalWorkSeconds + 1 : state.totalWorkSeconds,
    });
  },

  fastForward: (seconds: number) => {
    const state = get();
    if (!state.isRunning || seconds <= 0) return;

    const phaseDuration = state.phase === 'work' ? state.workDuration : state.breakDuration;
    const totalPhaseSeconds = phaseDuration * 60;

    // Cap at the phase boundary — the phase-end effect handles the rollover,
    // so overshooting here would skip a break.
    const newElapsed = Math.min(state.elapsedSeconds + seconds, totalPhaseSeconds);
    const workedSeconds = newElapsed - state.elapsedSeconds;

    set({
      elapsedSeconds: newElapsed,
      totalWorkSeconds:
        state.phase === 'work'
          ? state.totalWorkSeconds + workedSeconds
          : state.totalWorkSeconds,
    });
  },

  pause: () => {
    cancelSessionNotifications().catch(() => {});
    set({ isRunning: false, isPaused: true });
  },

  resume: () => {
    const state = get();
    const phaseDuration = state.phase === 'work' ? state.workDuration : state.breakDuration;
    const remaining = phaseDuration * 60 - state.elapsedSeconds;

    schedulePhaseEndNotification(remaining, state.phase).catch(() => {});
    set({ isRunning: true, isPaused: false });
  },

  startBreak: () => {
    cancelSessionNotifications().catch(() => {});
    const state = get();
    schedulePhaseEndNotification(state.breakDuration * 60, 'break').catch(() => {});

    set((s) => ({
      phase: 'break',
      elapsedSeconds: 0,
      pomodorosCompleted: s.pomodorosCompleted + 1,
    }));
  },

  startWork: () => {
    cancelSessionNotifications().catch(() => {});
    const state = get();
    schedulePhaseEndNotification(state.workDuration * 60, 'work').catch(() => {});

    set({ phase: 'work', elapsedSeconds: 0 });
  },

  reset: () => {
    cancelSessionNotifications().catch(() => {});
    set(initialState);
  },
}));
