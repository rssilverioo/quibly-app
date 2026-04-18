import { api } from '../lib/api';

export interface FocusArea {
  id: string;
  topic: string;
  status: 'weak' | 'learning' | 'mastered';
  score: number;
  source: 'auto' | 'manual';
  note?: string;
}

export interface StudyNote {
  note: string;
  tips: string[];
}

export async function getFocusAreas(): Promise<FocusArea[]> {
  return api.get<FocusArea[]>('/focus-areas');
}

export async function addFocusArea(topic: string): Promise<FocusArea> {
  return api.post<FocusArea>('/focus-areas/add', { topic });
}

export async function getStudyNote(topic: string): Promise<StudyNote> {
  return api.post<StudyNote>('/focus-areas/study-note', { topic });
}
