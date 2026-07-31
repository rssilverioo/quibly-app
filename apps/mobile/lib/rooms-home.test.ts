import { describe, expect, it } from 'vitest';
import { resolveRoomsHome } from './rooms-home';
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
