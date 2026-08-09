import { describe, expect, it } from 'vitest';
import type { RoomFeedPost, RoomSummary } from '../services/rooms';
import { collectSessionCopies, copyChipLabel, pickPrimaryCopy } from './published-post';

const room = (over: Partial<RoomSummary> & { id: string; name: string }): RoomSummary => ({
  member_count: 3,
  max_members: 50,
  total_sp: 0,
  last_post_at: null,
  unread_posts: 0,
  active_challenge: null,
  ...over,
});

/**
 * O post **como o servidor manda** — camelCase do Prisma, envelope legado da
 * liga. Ver `services/rooms.ts` para o porquê.
 */
const post = (id: string, session_id: string | null): RoomFeedPost => ({
  id,
  league_id: 'r1',
  session_id,
  user_id: 'u1',
  kind: session_id ? 'session' : 'standalone',
  caption: null,
  photo_url: null,
  show_proof_photo: false,
  created_at: '2026-08-02T22:00:00.000Z',
  user: { username: 'Rodrigo', handle: 'rodrigo', avatar_url: null },
  session: session_id
    ? {
        id: session_id,
        total_duration_minutes: '47',
        minutes: 47,
        points_earned: 90,
        xp_earned: 120,
        is_verified: false,
        proof_mode: false,
        subject: { id: 's-calc', name: 'Cálculo', color: '#1680AF' },
        proof_checks: [],
        proof_photo_url: null,
      }
    : null,
  reactions: {},
  user_reactions: [],
  latest_comments: [],
});

const challengeEndingAt = (endsAt: string) => ({
  id: 'ch',
  title: 'Sprint',
  metric_unit: 'min',
  ends_at: endsAt,
  server_time: '2026-08-02T22:00:00.000Z',
  participant_count: 4,
  me: { rank: 1, metric_value: 0 },
});

describe('collectSessionCopies', () => {
  it('reconhece a cópia pelo id da sessão, e ignora os outros posts', () => {
    const rooms = [room({ id: 'r1', name: 'Cursinho' })];
    const feeds = [[post('p0', 'outra'), post('p1', 's1'), post('p2', null)]];

    const copies = collectSessionCopies(rooms, feeds, 's1');

    expect(copies).toHaveLength(1);
    expect(copies[0].post.id).toBe('p1');
    expect(copies[0].roomName).toBe('Cursinho');
  });

  it('uma sala que falhou não derruba as outras', () => {
    const rooms = [room({ id: 'r1', name: 'A' }), room({ id: 'r2', name: 'B' })];
    const feeds = [null, [post('p1', 's1')]];

    expect(collectSessionCopies(rooms, feeds, 's1').map((c) => c.roomName)).toEqual(['B']);
  });

  it('não inventa atribuição a desafio, porque o servidor não manda nenhuma', () => {
    // O post do servidor não tem campo de desafio — só `league_id`, que é a
    // sala. O cliente já foi tipado com um `post.challenge.counted` que nunca
    // existiu. Afirmar "contou para o Sprint" sem o servidor ter dito é
    // exatamente o tipo de ficção que deixou o feed quebrado em silêncio.
    const rooms = [
      room({ id: 'r1', name: 'A', active_challenge: challengeEndingAt('2026-08-04T00:00:00.000Z') }),
      room({ id: 'r2', name: 'B' }),
    ];
    const feeds = [[post('p1', 's1')], [post('p2', 's1')]];

    for (const copy of collectSessionCopies(rooms, feeds, 's1')) {
      expect(copy.challengeTitle).toBeNull();
    }
  });

  it('sem id de sessão não procura nada', () => {
    expect(collectSessionCopies([room({ id: 'r1', name: 'A' })], [[post('p1', 's1')]], '')).toEqual([]);
  });
});

describe('pickPrimaryCopy', () => {
  it('prefere a sala com o desafio de prazo mais próximo', () => {
    const rooms = [
      room({ id: 'r1', name: 'Longe', active_challenge: challengeEndingAt('2026-09-01T00:00:00.000Z') }),
      room({ id: 'r2', name: 'Perto', active_challenge: challengeEndingAt('2026-08-04T00:00:00.000Z') }),
    ];
    const feeds = [[post('p1', 's1')], [post('p2', 's1')]];

    expect(pickPrimaryCopy(collectSessionCopies(rooms, feeds, 's1'))?.roomName).toBe('Perto');
  });

  it('sem desafio em nenhuma, vai para a de atividade mais recente', () => {
    const rooms = [
      room({ id: 'r1', name: 'Parada', last_post_at: '2026-07-01T00:00:00.000Z' }),
      room({ id: 'r2', name: 'Viva', last_post_at: '2026-08-02T00:00:00.000Z' }),
    ];
    const feeds = [[post('p1', 's1')], [post('p2', 's1')]];

    expect(pickPrimaryCopy(collectSessionCopies(rooms, feeds, 's1'))?.roomName).toBe('Viva');
  });

  it('um desafio vence qualquer atividade recente', () => {
    const rooms = [
      room({ id: 'r1', name: 'Viva', last_post_at: '2026-08-02T00:00:00.000Z' }),
      room({ id: 'r2', name: 'Desafio', active_challenge: challengeEndingAt('2026-12-01T00:00:00.000Z') }),
    ];
    const feeds = [[post('p1', 's1')], [post('p2', 's1')]];

    expect(pickPrimaryCopy(collectSessionCopies(rooms, feeds, 's1'))?.roomName).toBe('Desafio');
  });

  it('empate total cai na ordem de `GET /rooms`, para o destino não oscilar', () => {
    const rooms = [room({ id: 'r1', name: 'A' }), room({ id: 'r2', name: 'B' })];
    const feeds = [[post('p1', 's1')], [post('p2', 's1')]];

    expect(pickPrimaryCopy(collectSessionCopies(rooms, feeds, 's1'))?.roomName).toBe('A');
  });

  it('sem cópia nenhuma, não inventa destino', () => {
    expect(pickPrimaryCopy([])).toBeNull();
  });
});

describe('copyChipLabel', () => {
  it('acrescenta o desafio quando a cópia carrega um', () => {
    // O rótulo continua sabendo compor `Sala · Desafio` para o dia em que o
    // feed mandar a atribuição — só não há hoje de onde tirá-la.
    const rooms = [room({ id: 'r1', name: 'Cursinho' })];
    const feeds = [[post('p1', 's1')]];
    const copy = { ...collectSessionCopies(rooms, feeds, 's1')[0], challengeTitle: 'Sprint de Julho' };

    expect(copyChipLabel(copy)).toBe('Cursinho · Sprint de Julho');
  });

  it('sem desafio, o chip é só o nome da sala', () => {
    const rooms = [room({ id: 'r1', name: 'Família' })];
    const feeds = [[post('p1', 's1')]];

    expect(copyChipLabel(collectSessionCopies(rooms, feeds, 's1')[0])).toBe('Família');
  });
});
