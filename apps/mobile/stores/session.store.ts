import { create } from 'zustand';
import type {
  TimerMode,
  StudySession,
  ProofCheck,
} from '@quibly/shared';
import { TIMER_PRESETS, PROOF_CHECK } from '@quibly/shared/constants';
import * as sessionsService from '../services/sessions';
import {
  schedulePhaseEndNotification,
  scheduleProofCheckNotification,
  cancelSessionNotifications,
} from '../lib/notifications';

/**
 * Generate a random time (in seconds) within a work phase for a proof check.
 * Respects MIN_DELAY and END_BUFFER from constants.
 * Returns null if the phase is too short for a proof check.
 */
function randomPhaseCheckSeconds(workDurationMinutes: number): number | null {
  const earliest = PROOF_CHECK.MIN_DELAY_MINUTES * 60;
  const latest = (workDurationMinutes - PROOF_CHECK.END_BUFFER_MINUTES) * 60;
  if (latest <= earliest) return null;
  return Math.round(earliest + Math.random() * (latest - earliest));
}

interface SessionState {
  currentSession: StudySession | null;
  timerMode: TimerMode;
  workDuration: number;
  breakDuration: number;
  proofMode: boolean;
  elapsedSeconds: number;
  totalWorkSeconds: number;
  isRunning: boolean;
  phase: 'work' | 'break';
  pomodorosCompleted: number;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  leagueId: string | null;
  proofChecks: ProofCheck[];
  pendingProofCheck: ProofCheck | null;
  phaseProofCheckAt: number | null;
  proofCheckTriggering: boolean;
  userId: string | null;
  streakDays: number;
  isPaused: boolean;

  setTimerMode: (mode: TimerMode) => void;
  setWorkDuration: (minutes: number) => void;
  setBreakDuration: (minutes: number) => void;
  setProofMode: (enabled: boolean) => void;
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
    isVerified: boolean;
    score?: Record<string, number>;
    previousLevel?: number;
    newLevel?: number;
  }>;
  tick: () => void;
  pause: () => void;
  resume: () => void;
  startBreak: () => void;
  startWork: () => void;
  submitProof: (photoUrl: string) => Promise<void>;
  setPendingProofCheck: (check: ProofCheck | null) => void;
  fastForward: (seconds: number) => void;
  reset: () => void;
}

const initialState = {
  currentSession: null,
  timerMode: 'pomodoro' as TimerMode,
  workDuration: TIMER_PRESETS.pomodoro.work,
  breakDuration: TIMER_PRESETS.pomodoro.break,
  proofMode: false,
  elapsedSeconds: 0,
  totalWorkSeconds: 0,
  isRunning: false,
  phase: 'work' as const,
  pomodorosCompleted: 0,
  subjectId: null,
  subjectName: null,
  subjectColor: null,
  leagueId: null,
  proofChecks: [] as ProofCheck[],
  pendingProofCheck: null,
  phaseProofCheckAt: null as number | null,
  proofCheckTriggering: false,
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
  setProofMode: (enabled) => set({ proofMode: enabled }),
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
      proof_mode: state.proofMode,
    });

    // Generate random proof check time for first work phase
    const checkAt = state.proofMode
      ? randomPhaseCheckSeconds(state.workDuration)
      : null;

    set({
      currentSession: session,
      isRunning: true,
      elapsedSeconds: 0,
      totalWorkSeconds: 0,
      phase: 'work',
      pomodorosCompleted: 0,
      proofChecks: [],
      pendingProofCheck: null,
      phaseProofCheckAt: checkAt,
      proofCheckTriggering: false,
    });

    // Schedule local notifications
    const phaseSeconds = state.workDuration * 60;
    schedulePhaseEndNotification(phaseSeconds, 'work').catch(() => {});
    if (checkAt !== null && checkAt > 0) {
      scheduleProofCheckNotification(checkAt).catch(() => {});
    }
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
        isVerified: false,
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
      isVerified: result.session?.is_verified ?? false,
      score: result.score,
      previousLevel: result.previous_level,
      newLevel: result.new_level,
    };
  },

  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    const newElapsed = state.elapsedSeconds + 1;
    const newTotalWork =
      state.phase === 'work'
        ? state.totalWorkSeconds + 1
        : state.totalWorkSeconds;

    set({
      elapsedSeconds: newElapsed,
      totalWorkSeconds: newTotalWork,
    });

    // Check if proof check should trigger (per-phase)
    if (
      state.proofMode &&
      state.phase === 'work' &&
      !state.pendingProofCheck &&
      !state.proofCheckTriggering &&
      state.phaseProofCheckAt !== null &&
      newElapsed >= state.phaseProofCheckAt
    ) {
      // Trigger proof check: create record on server, then show modal
      set({ proofCheckTriggering: true, phaseProofCheckAt: null });

      const sessionId = state.currentSession?.id;
      if (sessionId) {
        sessionsService.triggerProofCheck(sessionId)
          .then((check) => {
            set({ pendingProofCheck: check, proofCheckTriggering: false });
          })
          .catch(() => {
            // Fallback: create local check (photo upload won't work but check counts)
            set({
              pendingProofCheck: {
                id: `local_check_${Date.now()}`,
                session_id: sessionId,
                user_id: state.userId ?? '',
                triggered_at: new Date().toISOString(),
                responded_at: null,
                photo_url: null,
                status: 'pending',
                deadline_at: new Date(
                  Date.now() + PROOF_CHECK.RESPONSE_DEADLINE_SECONDS * 1000
                ).toISOString(),
              } as ProofCheck,
              proofCheckTriggering: false,
            });
          });
      } else {
        set({ proofCheckTriggering: false });
      }
    }
  },

  pause: () => {
    cancelSessionNotifications().catch(() => {});
    set({ isRunning: false, isPaused: true });
  },

  resume: () => {
    const state = get();
    const currentPhaseDuration = state.phase === 'work' ? state.workDuration : state.breakDuration;
    const remainingSeconds = (currentPhaseDuration * 60) - state.elapsedSeconds;

    schedulePhaseEndNotification(remainingSeconds, state.phase).catch(() => {});

    // Re-schedule proof check notification if not yet triggered in this phase
    if (state.proofMode && state.phase === 'work' && state.phaseProofCheckAt !== null) {
      const secondsUntilCheck = state.phaseProofCheckAt - state.elapsedSeconds;
      if (secondsUntilCheck > 0) {
        scheduleProofCheckNotification(secondsUntilCheck).catch(() => {});
      }
    }

    set({ isRunning: true, isPaused: false });
  },

  startBreak: () => {
    cancelSessionNotifications().catch(() => {});
    const state = get();
    const breakSeconds = state.breakDuration * 60;
    schedulePhaseEndNotification(breakSeconds, 'break').catch(() => {});

    set((s) => ({
      phase: 'break',
      elapsedSeconds: 0,
      pomodorosCompleted: s.pomodorosCompleted + 1,
      phaseProofCheckAt: null,
    }));
  },

  startWork: () => {
    cancelSessionNotifications().catch(() => {});
    const state = get();
    const workSeconds = state.workDuration * 60;
    schedulePhaseEndNotification(workSeconds, 'work').catch(() => {});

    // Generate new random proof check time for this work phase
    const checkAt = state.proofMode
      ? randomPhaseCheckSeconds(state.workDuration)
      : null;

    if (checkAt !== null && checkAt > 0) {
      scheduleProofCheckNotification(checkAt).catch(() => {});
    }

    set({ phase: 'work', elapsedSeconds: 0, phaseProofCheckAt: checkAt });
  },

  submitProof: async (photoUrl: string) => {
    const state = get();
    if (!state.pendingProofCheck) return;

    const updatedCheck: ProofCheck = {
      ...state.pendingProofCheck,
      status: 'passed',
      responded_at: new Date().toISOString(),
      photo_url: photoUrl,
    };

    const updatedChecks = [...state.proofChecks, updatedCheck];

    set({
      proofChecks: updatedChecks,
      pendingProofCheck: null,
    });
  },

  setPendingProofCheck: (check) => {
    if (check === null) {
      const state = get();
      if (state.pendingProofCheck) {
        const missedCheck: ProofCheck = {
          ...state.pendingProofCheck,
          status: 'missed',
          responded_at: new Date().toISOString(),
        };
        set({
          proofChecks: [...state.proofChecks, missedCheck],
          pendingProofCheck: null,
        });
      }
    } else {
      set({ pendingProofCheck: check });
    }
  },

  fastForward: (seconds: number) => {
    const state = get();
    if (!state.isRunning || seconds <= 0) return;

    const currentPhaseDuration = state.phase === 'work' ? state.workDuration : state.breakDuration;
    const totalPhaseSeconds = currentPhaseDuration * 60;
    let newElapsed = state.elapsedSeconds + seconds;
    let newTotalWork = state.phase === 'work'
      ? state.totalWorkSeconds + seconds
      : state.totalWorkSeconds;

    // If time exceeds current phase, cap at phase end
    if (newElapsed > totalPhaseSeconds) {
      const overflowSeconds = newElapsed - totalPhaseSeconds;
      newElapsed = totalPhaseSeconds;
      if (state.phase === 'work') {
        newTotalWork = state.totalWorkSeconds + (seconds - overflowSeconds);
      }
    }

    set({
      elapsedSeconds: newElapsed,
      totalWorkSeconds: newTotalWork,
    });

    // Check proof trigger after fast-forward (per-phase)
    if (
      state.proofMode &&
      state.phase === 'work' &&
      !state.pendingProofCheck &&
      !state.proofCheckTriggering &&
      state.phaseProofCheckAt !== null &&
      newElapsed >= state.phaseProofCheckAt
    ) {
      set({ proofCheckTriggering: true, phaseProofCheckAt: null });

      const sessionId = state.currentSession?.id;
      if (sessionId) {
        sessionsService.triggerProofCheck(sessionId)
          .then((check) => {
            set({ pendingProofCheck: check, proofCheckTriggering: false });
          })
          .catch(() => {
            set({
              pendingProofCheck: {
                id: `local_check_${Date.now()}`,
                session_id: sessionId,
                user_id: state.userId ?? '',
                triggered_at: new Date().toISOString(),
                responded_at: null,
                photo_url: null,
                status: 'pending',
                deadline_at: new Date(
                  Date.now() + PROOF_CHECK.RESPONSE_DEADLINE_SECONDS * 1000
                ).toISOString(),
              } as ProofCheck,
              proofCheckTriggering: false,
            });
          });
      } else {
        set({ proofCheckTriggering: false });
      }
    }
  },

  reset: () => {
    cancelSessionNotifications().catch(() => {});
    set(initialState);
  },
}));
