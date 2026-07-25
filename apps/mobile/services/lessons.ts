import { api } from '../lib/api';
import type { FlashcardSet, Quiz } from '@quibly/shared';

export type LessonSource = 'audio' | 'document' | 'photo';
export type LessonStatus = 'processing' | 'ready' | 'failed';

export interface KeyPoint {
  term: string;
  explanation: string;
}

/** Shape returned by `GET /lessons` — no raw text, no derived material. */
export interface LessonSummary {
  id: string;
  title: string;
  subject: string | null;
  source: LessonSource;
  status: LessonStatus;
  summary: string | null;
  duration_sec: number | null;
  created_at: string;
  _count: { flashcard_sets: number; quizzes: number };
}

export interface Lesson extends LessonSummary {
  language: string;
  raw_text: string | null;
  key_points: KeyPoint[];
  open_questions: string[];
  error_message: string | null;
  processed_at: string | null;
  flashcard_sets: (FlashcardSet & { _count: { flashcards: number } })[];
  quizzes: (Quiz & { _count: { questions: number } })[];
}

export interface CaptureFile {
  uri: string;
  name: string;
  /** Mime type decides the route: audio/* transcribes, image/* runs OCR. */
  type: string;
}

/**
 * Hand a capture to the server. Comes back immediately with `processing` —
 * poll `getLesson` until the status settles.
 */
export async function captureLesson(
  file: CaptureFile,
  opts: { title?: string; subject?: string; language?: string; durationSec?: number } = {},
): Promise<Lesson> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  if (opts.title) formData.append('title', opts.title);
  if (opts.subject) formData.append('subject', opts.subject);
  if (opts.language) formData.append('language', opts.language);
  if (opts.durationSec != null) {
    formData.append('duration_sec', String(Math.round(opts.durationSec)));
  }

  return api.upload<Lesson>('/lessons/capture', formData);
}

export async function listLessons(): Promise<LessonSummary[]> {
  return api.get<LessonSummary[]>('/lessons');
}

export async function getLesson(id: string): Promise<Lesson> {
  return api.get<Lesson>(`/lessons/${id}`);
}

export async function generateFlashcardsFromLesson(id: string): Promise<FlashcardSet> {
  return api.post<FlashcardSet>(`/lessons/${id}/flashcards`);
}

export async function generateQuizFromLesson(id: string): Promise<Quiz> {
  return api.post<Quiz>(`/lessons/${id}/quiz`);
}

/** `grounded: false` means the class never covered it — surface that. */
export async function askLesson(
  id: string,
  question: string,
): Promise<{ answer: string; grounded: boolean }> {
  return api.post(`/lessons/${id}/ask`, { question });
}

export async function deleteLesson(id: string): Promise<void> {
  await api.delete(`/lessons/${id}`);
}
