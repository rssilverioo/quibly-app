import type { RoomSummary } from '../services/rooms';

export type RoomsHomeState =
  | { kind: 'empty' }
  | { kind: 'feed'; room: RoomSummary }
  | { kind: 'list'; rooms: RoomSummary[] };

export function resolveRoomsHome(rooms: RoomSummary[]): RoomsHomeState {
  if (rooms.length === 0) return { kind: 'empty' };
  if (rooms.length === 1) return { kind: 'feed', room: rooms[0] };
  return { kind: 'list', rooms };
}

export function challengeTimeLeft(endsAt: string, serverTime: string): { days: number; urgent: boolean } {
  const milliseconds = Math.max(0, new Date(endsAt).getTime() - new Date(serverTime).getTime());
  const days = Math.ceil(milliseconds / 86_400_000);
  return { days, urgent: days <= 3 };
}
