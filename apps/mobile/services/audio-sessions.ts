import { api } from '../lib/api';

export type AudioSegmentType =
  | 'intro'
  | 'card_q'
  | 'card_a'
  | 'quiz_q'
  | 'quiz_a'
  | 'explain'
  | 'recap'
  | 'close';

export interface AudioClip {
  clipId: string;
  order: number;
  type: AudioSegmentType;
  url: string;
  durationSec: number;
  pauseAfterMs: number;
  cardId?: string;
}

export interface AudioStudySessionDto {
  id: string;
  status: 'generating' | 'ready' | 'failed';
  language: string;
  plannedDurationMinutes: number;
  totalDurationSec: number;
  clips: AudioClip[];
  errorMessage?: string | null;
  studySessionId?: string | null;
}

export async function createAudioSession(
  flashcardSetId: string,
  durationMinutes: number,
): Promise<{ id: string; status: string }> {
  return api.post('/audio-sessions', {
    flashcard_set_id: flashcardSetId,
    duration_minutes: durationMinutes,
  });
}

export async function getAudioSession(id: string): Promise<AudioStudySessionDto> {
  return api.get(`/audio-sessions/${id}`);
}

export async function startAudioSession(
  id: string,
  subjectId: string,
  leagueId?: string,
): Promise<{ studySessionId: string }> {
  return api.post(`/audio-sessions/${id}/start`, {
    subject_id: subjectId,
    league_id: leagueId,
  });
}

export async function pollUntilReady(
  id: string,
  timeoutMs = 60000,
): Promise<AudioStudySessionDto> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = await getAudioSession(id);
    if (session.status === 'ready') return session;
    if (session.status === 'failed') {
      throw new Error(session.errorMessage ?? 'Audio session generation failed');
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Audio session generation timed out');
}
