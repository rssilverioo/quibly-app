import { api } from '../lib/api';

export interface DailyTask {
  id: string;
  type: 'review_cards' | 'take_quiz' | 'generate_topic' | 'pomodoro' | 'upload';
  title: string;
  description: string;
  completed: boolean;
  params?: Record<string, string>;
}

export interface DailyPlan {
  id: string;
  date: string;
  tasks: DailyTask[];
}

export async function getDailyPlan(): Promise<DailyPlan> {
  return api.get<DailyPlan>('/daily-plan');
}

export async function completeTask(taskId: string): Promise<DailyPlan> {
  return api.post<DailyPlan>(`/daily-plan/${taskId}/complete`);
}
