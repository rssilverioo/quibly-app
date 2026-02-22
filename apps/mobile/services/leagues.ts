import { api } from '../lib/api';
import type { League, LeagueMember, Profile } from '@quibly/shared';

export async function createLeague(
  _userId: string,
  data: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    privacy: 'public' | 'private';
    mode: string;
    max_members?: number;
    display_name: string;
  }
): Promise<League> {
  return api.post<League>('/leagues', data);
}

export async function joinLeague(
  _userId: string,
  inviteCode: string,
  displayName: string,
): Promise<League> {
  return api.post<League>('/leagues/join', { invite_code: inviteCode, display_name: displayName });
}

export interface LeaguePreview {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  privacy: string;
  status: string;
  start_date: string;
  end_date: string;
  max_members: number;
  member_count: number;
  is_full: boolean;
  is_member: boolean;
}

export async function getLeaguePreview(inviteCode: string): Promise<LeaguePreview> {
  return api.get<LeaguePreview>(`/leagues/invite/${inviteCode}`);
}

export async function getLeague(leagueId: string): Promise<League | null> {
  try {
    return await api.get<League>(`/leagues/${leagueId}`);
  } catch {
    return null;
  }
}

export async function getMyLeagues(_userId?: string): Promise<League[]> {
  return api.get<League[]>('/leagues');
}

export async function getMyLeaguesByStatus(
  _userId: string,
  _status: string
): Promise<League[]> {
  const leagues = await api.get<League[]>('/leagues');
  return leagues;
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  return api.get<LeagueMember[]>(`/leagues/${leagueId}/members`);
}

export async function getLeaderboard(
  leagueId: string,
  period: 'weekly' | 'monthly' | 'all_time' = 'all_time'
) {
  return api.get<any[]>(`/leagues/${leagueId}/leaderboard?period=${period}`);
}

export async function leaveLeague(leagueId: string, _userId?: string) {
  return api.post(`/leagues/${leagueId}/leave`);
}

export async function updateLeague(
  leagueId: string,
  data: Record<string, any>
) {
  return api.patch(`/leagues/${leagueId}`, data);
}
