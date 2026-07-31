import { describe, expect, it } from 'vitest';
import { challengeTimeLeft, resolveRoomsHome } from './rooms-home';
import type { RoomSummary } from '../services/rooms';

const room = (id: string): RoomSummary => ({
  id,
  name: `Sala ${id}`,
  member_count: 4,
  total_sp: 0,
  last_post_at: null,
  unread_posts: 0,
  active_challenge: null,
});

describe('challengeTimeLeft', () => {
  it('uses server time instead of the device clock', () => {
    expect(challengeTimeLeft('2026-08-08T12:00:00Z', '2026-08-06T12:00:00Z'))
      .toEqual({ days: 2, urgent: true });
  });
});

describe('resolveRoomsHome', () => {
  it('ensina a criar ou entrar quando não há sala', () => {
    expect(resolveRoomsHome([])).toEqual({ kind: 'empty' });
  });

  it('abre diretamente o feed quando há uma sala', () => {
    expect(resolveRoomsHome([room('1')])).toMatchObject({ kind: 'feed', room: { id: '1' } });
  });

  it('mostra a lista quando há mais de uma sala', () => {
    expect(resolveRoomsHome([room('1'), room('2')])).toMatchObject({ kind: 'list' });
  });
});
