import { api } from '../lib/api';
import type { FlashcardSet, Quiz } from '@quibly/shared';

export async function generateFlashcardsFromDocument(
  documentId: string,
  language?: string,
): Promise<FlashcardSet> {
  return api.post<FlashcardSet>('/generate/flashcards', {
    document_id: documentId,
    language,
  });
}

export async function generateQuizFromDocument(
  documentId: string,
  language?: string,
): Promise<Quiz> {
  return api.post<Quiz>('/generate/quiz', {
    document_id: documentId,
    language,
  });
}

export async function generateFromTopic(
  topic: string,
  type: 'flashcards' | 'quiz',
  language?: string,
): Promise<FlashcardSet | Quiz> {
  return api.post<FlashcardSet | Quiz>('/generate/topic', {
    topic,
    type,
    language,
  });
}
