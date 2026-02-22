import { api } from '../lib/api';
import type { Subject } from '@quibly/shared';

export async function createSubject(
  _userId: string,
  name: string,
  color: string,
  icon?: string
): Promise<Subject> {
  return api.post<Subject>('/subjects', { name, color, icon });
}

export async function getSubjects(_userId?: string): Promise<Subject[]> {
  return api.get<Subject[]>('/subjects');
}

export async function deleteSubject(subjectId: string): Promise<void> {
  await api.delete(`/subjects/${subjectId}`);
}
