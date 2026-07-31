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
