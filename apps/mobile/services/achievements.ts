import { api } from '../lib/api';
import type { Achievement, UserAchievement } from '@quibly/shared';

export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlocked_at: string | null;
}

export async function getAllAchievements(): Promise<AchievementWithStatus[]> {
  return api.get<AchievementWithStatus[]>('/achievements');
}

export async function getUnlockedAchievements(): Promise<UserAchievement[]> {
  return api.get<UserAchievement[]>('/achievements/unlocked');
}

export async function seedAchievements(): Promise<void> {
  return api.post('/achievements/seed');
}
