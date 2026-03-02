import { api } from '../lib/api';

type XpAction = 'flashcard_review' | 'quiz_correct' | 'quiz_wrong';

export interface XpResult {
  xp_awarded: number;
  total_xp: number;
  previous_level: number;
  new_level: number;
  level_up: boolean;
  current_streak: number;
}

export async function awardXp(action: XpAction): Promise<XpResult> {
  return api.post<XpResult>('/gamification/xp', { action });
}
