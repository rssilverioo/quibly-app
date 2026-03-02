import { api } from '../lib/api';
import type { Plan } from '@quibly/shared';

export interface UsageResponse {
  plan: Plan;
  flashcard_sets: { used: number; limit: number };
  quizzes: { used: number; limit: number };
}

export async function getUsage(): Promise<UsageResponse> {
  return api.get<UsageResponse>('/usage');
}
