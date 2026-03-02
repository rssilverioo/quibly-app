import { api } from '../lib/api';
import type { Quiz } from '@quibly/shared';

export async function listQuizzes(): Promise<Quiz[]> {
  return api.get<Quiz[]>('/quizzes');
}

export async function getQuiz(id: string): Promise<Quiz> {
  return api.get<Quiz>(`/quizzes/${id}`);
}

export async function deleteQuiz(id: string): Promise<void> {
  await api.delete(`/quizzes/${id}`);
}
