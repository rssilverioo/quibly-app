import { api, ApiError } from '../lib/api';
import type { StudySession, TimerMode } from '@quibly/shared';

/**
 * Session lifecycle client. Mirrors docs/API-SESSIONS.md.
 *
 * The rule that shapes this whole file: **the client never sends time.** No
 * duration, no cycle count, no start timestamp. The server measures from its
 * own clock, and everything here either asks it for a number or hands it an
 * event. Anything that looks like the app computing minutes is a bug.
 */

export interface StartSessionData {
  subject_id: string;
  league_id?: string;
  timer_mode: TimerMode;
  /** Ignored by the server for `stopwatch`. */
  work_duration?: number;
  break_duration?: number;
  proof_mode?: boolean;
}

/** What the server tells us about a live session, on start and on resume. */
export interface LiveSession extends StudySession {
  /** The server's count, already net of pauses. This is what the UI renders. */
  elapsed_seconds: number;
  heartbeat_interval_seconds: number;
  heartbeat_grace_seconds: number;
  /**
   * ISO. Até quando o servidor tolera esta sessão calada.
   *
   * Vem dele, e não de conta feita aqui: duas cópias da mesma regra divergem, e
   * divergir aqui significa o app dizer "desconectado" numa sessão que o
   * servidor mantém viva — quem estuda em modo avião perderia o progresso.
   */
  silence_tolerated_until?: string;
}

export interface HeartbeatResult {
  session_id: string;
  status: 'active' | 'paused';
  server_time: string;
  elapsed_seconds: number;
  next_heartbeat_in_seconds: number;
  /** Reafirmado a cada batida: o limite anda com o último batimento. */
  silence_tolerated_until?: string;
}

/**
 * Thrown when `POST /sessions/start` returns 409 because a session is already
 * live. This is *not* an error state for the user — it is the normal shape of
 * "the app was killed and reopened". The caller should offer to resume.
 */
export class SessionAlreadyLiveError extends Error {
  constructor(
    readonly activeSession: {
      id: string;
      status: string;
      started_at: string;
      subject_id: string;
    },
  ) {
    super('A session is already live');
    this.name = 'SessionAlreadyLiveError';
  }
}

export async function startSession(data: StartSessionData): Promise<LiveSession> {
  try {
    return await api.post<LiveSession>('/sessions/start', {
      subject_id: data.subject_id,
      league_id: data.league_id,
      timer_mode: data.timer_mode,
      // Omitted entirely for stopwatch so the server keeps its defaults rather
      // than recording a target duration the mode does not have.
      ...(data.timer_mode === 'stopwatch'
        ? {}
        : { work_duration: data.work_duration, break_duration: data.break_duration }),
      proof_mode: data.proof_mode ?? false,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.body?.active_session) {
      throw new SessionAlreadyLiveError(err.body.active_session);
    }
    throw err;
  }
}

/**
 * Keep-alive. Returns the server's elapsed count, which the caller should
 * reconcile against whatever it has been rendering locally between beats.
 */
export async function heartbeat(sessionId: string): Promise<HeartbeatResult> {
  return api.post<HeartbeatResult>(`/sessions/${sessionId}/heartbeat`);
}

export async function pauseSession(sessionId: string): Promise<StudySession> {
  return api.post<StudySession>(`/sessions/${sessionId}/pause`);
}

export async function resumeSession(sessionId: string): Promise<StudySession> {
  return api.post<StudySession>(`/sessions/${sessionId}/resume`);
}

export interface EndSessionResult {
  session: StudySession;
  score: any;
  newAchievements?: string[];
  previous_level?: number;
  new_level?: number;
}

/**
 * Finish and score. **No body** — see docs/API-SESSIONS.md §4. The duration,
 * the pomodoro cycle count and the "ended early" flag are all derived on the
 * server from its own clock and the recorded pause intervals.
 */
export async function endSession(sessionId: string): Promise<EndSessionResult> {
  return api.post<EndSessionResult>(`/sessions/${sessionId}/end`);
}

/** Throw the session away. Scores nothing, unlike `endSession`. */
export async function abandonSession(sessionId: string): Promise<void> {
  await api.post(`/sessions/${sessionId}/abandon`);
}

export async function getSession(sessionId: string): Promise<StudySession | null> {
  try {
    return await api.get<StudySession>(`/sessions/${sessionId}`);
  } catch {
    return null;
  }
}

/**
 * The user's open timer, if any — paused counts. Carries `elapsed_seconds`, so
 * a client that was killed and relaunched rebuilds its timer from the truth
 * instead of guessing from a persisted local counter.
 */
export async function getActiveSession(): Promise<LiveSession | null> {
  try {
    return await api.get<LiveSession | null>('/sessions/active');
  } catch {
    return null;
  }
}

export async function getUserSessions(
  _userId?: string,
  limitCount = 20,
  page = 1,
): Promise<StudySession[]> {
  const result = await api.get<{ sessions: StudySession[] }>(
    `/sessions?page=${page}&limit=${limitCount}`,
  );
  return result.sessions;
}

export interface StudyDate {
  date: string;
  minutes: number;
}

export async function getStudyDates(year: number, month: number): Promise<StudyDate[]> {
  const result = await api.get<{ dates: StudyDate[] }>(
    `/sessions/study-dates?year=${year}&month=${month}`,
  );
  return result.dates;
}

export interface StudyHeatmap {
  /** Primeiro dia da janela, `YYYY-MM-DD`. */
  from: string;
  /** Último dia — sempre hoje. */
  to: string;
  /** Só os dias COM estudo. Os zeros a tela preenche. */
  days: StudyDate[];
}

/**
 * O mapa de constância — a grade estilo GitHub do perfil.
 *
 * Janela corrida terminando **hoje**, e não o mês corrente: um mapa que corta
 * no dia 1º esconde justamente a sequência recente. 371 dias são 53 semanas
 * cheias, o mesmo recorte do GitHub.
 *
 * Separado de `getStudyDates`, que continua servindo o calendário mensal do
 * perfil: são duas perguntas diferentes sobre os mesmos dados.
 */
export async function getStudyHeatmap(days = 371): Promise<StudyHeatmap> {
  return api.get<StudyHeatmap>(`/sessions/study-heatmap?days=${days}`);
}
