import { api } from '../lib/api';
import type { FlashcardSet } from '@quibly/shared';

export async function listFlashcardSets(): Promise<FlashcardSet[]> {
  return api.get<FlashcardSet[]>('/flashcard-sets');
}

export async function getFlashcardSet(id: string): Promise<FlashcardSet> {
  return api.get<FlashcardSet>(`/flashcard-sets/${id}`);
}

export async function deleteFlashcardSet(id: string): Promise<void> {
  await api.delete(`/flashcard-sets/${id}`);
}
