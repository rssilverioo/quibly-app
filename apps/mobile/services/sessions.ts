import { api } from '../lib/api';
import type { StudySession, TimerMode, ProofCheck } from '@quibly/shared';

export interface StartSessionData {
  user_id: string;
  subject_id: string;
  league_id?: string;
  timer_mode: TimerMode;
  work_duration: number;
  break_duration: number;
  proof_mode: boolean;
}

export async function startSession(data: StartSessionData): Promise<StudySession> {
  return api.post<StudySession>('/sessions/start', {
    subject_id: data.subject_id,
    league_id: data.league_id,
    timer_mode: data.timer_mode,
    work_duration: data.work_duration,
    break_duration: data.break_duration,
    proof_mode: data.proof_mode,
  });
}

export async function endSession(
  sessionId: string,
  data: {
    pomodoro_cycles_completed: number;
    total_duration_minutes: number;
  }
): Promise<{ session: StudySession; score: any; previous_level?: number; new_level?: number }> {
  return api.post('/sessions/end', {
    session_id: sessionId,
    pomodoro_cycles_completed: data.pomodoro_cycles_completed,
    total_duration_minutes: data.total_duration_minutes,
  });
}

export async function getSession(sessionId: string): Promise<StudySession | null> {
  try {
    return await api.get<StudySession>(`/sessions/${sessionId}`);
  } catch {
    return null;
  }
}

export async function getActiveSession(_userId?: string): Promise<StudySession | null> {
  try {
    return await api.get<StudySession | null>('/sessions/active');
  } catch {
    return null;
  }
}

export async function getUserSessions(
  _userId?: string,
  limitCount = 20,
  page = 1
): Promise<StudySession[]> {
  const result = await api.get<{ sessions: StudySession[] }>(
    `/sessions?page=${page}&limit=${limitCount}`
  );
  return result.sessions;
}

export interface StudyDate {
  date: string;
  minutes: number;
}

export async function getStudyDates(year: number, month: number): Promise<StudyDate[]> {
  const result = await api.get<{ dates: StudyDate[] }>(
    `/sessions/study-dates?year=${year}&month=${month}`
  );
  return result.dates;
}

export async function abandonSession(sessionId: string): Promise<void> {
  await api.post(`/sessions/${sessionId}/abandon`);
}

export async function triggerProofCheck(sessionId: string): Promise<ProofCheck> {
  return api.post<ProofCheck>(`/proof-checks/trigger/${sessionId}`);
}
