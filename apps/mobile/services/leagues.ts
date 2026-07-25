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

/**
 * `GET /leagues` decorates each league with the caller's standing in it —
 * fields that don't exist on the bare `League` row.
 */
export type LeagueWithStanding = League & {
  member_count?: number;
  user_role?: string;
  user_total_sp?: number;
  user_rank?: number | null;
};

export async function getMyLeagues(_userId?: string): Promise<LeagueWithStanding[]> {
  return api.get<LeagueWithStanding[]>('/leagues');
}

export async function getMyLeaguesByStatus(
  _userId: string,
  _status: string
): Promise<League[]> {
  const leagues = await api.get<League[]>('/leagues');
  return leagues;
}

export interface LiveMember {
  session_id: string;
  user_id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  subject_name: string;
  subject_color: string;
  league_id: string;
  league_name: string;
  proof_mode: boolean;
  started_at: string;
  elapsed_minutes: number;
}

/** Everyone in your leagues who is in a study session right now. */
export async function getLiveMembers(): Promise<LiveMember[]> {
  try {
    return await api.get<LiveMember[]>('/leagues/live');
  } catch {
    return [];
  }
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
