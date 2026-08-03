import { describe, expect, it } from 'vitest';
import { feedPagePosts, roomFeedPostToCardPost } from './feed-post';
import type { RoomFeedPost } from '../services/rooms';

/**
 * Este arquivo existe porque `roomFeedPostToCardPost` é o **único** ponto de
 * tradução entre o que o servidor manda e o que as telas desenham — e porque
 * ele já esteve errado por semanas sem que nada acusasse.
 *
 * Por isso as fixtures aqui não são inventadas: são o formato que
 * `apps/api/src/feed/feed.service.ts` de fato devolve, campo a campo, incluindo
 * as partes desconfortáveis (camelCase do Prisma, `Decimal` como string, e as
 * duas grafias divergentes entre as duas rotas de feed).
 */

/** Um check-in de foto avulsa, como sai de `POST /rooms/:id/posts` e volta no feed. */
const photoPost: RoomFeedPost = {
  id: 'post-foto',
  league_id: 'sala-1',
  session_id: null,
  user_id: 'user-ana',
  kind: 'standalone',
  caption: 'treino da manhã',
  photo_url: 'https://fly.storage.tigris.dev/quibly/room-posts/sala-1/user-ana/post-foto',
  // A coluna é `@default(false)` e a rota de post avulso nunca a escreve.
  show_proof_photo: false,
  created_at: '2026-08-03T09:12:00.000Z',
  user: { username: 'Ana', handle: 'ana', avatar_url: 'https://cdn.test/ana.jpg' },
  session: null,
  reactions: { '🔥': 2 },
  user_reactions: ['🔥'],
  latest_comments: [],
};

/** Um post de sessão com prova aprovada, como o fan-out do `end` cria. */
const sessionPost: RoomFeedPost = {
  id: 'post-sessao',
  league_id: 'sala-1',
  session_id: 'sess-1',
  user_id: 'user-rod',
  kind: 'session',
  caption: null,
  // Já resolvido pelo servidor: `post.photo_url ?? proof_photo_url`.
  photo_url: 'https://cdn.test/prova.jpg',
  show_proof_photo: true,
  created_at: '2026-08-03T08:00:00.000Z',
  user: { username: 'Rodrigo', handle: 'rod', avatar_url: null },
  session: {
    id: 'sess-1',
    // `Decimal` do Prisma chega como string no JSON — de propósito na fixture.
    total_duration_minutes: '47.00',
    minutes: 47,
    points_earned: 90,
    xp_earned: 120,
    is_verified: true,
    proof_mode: true,
    subject: { id: 'subj-calc', name: 'Cálculo', color: '#1680AF' },
    proof_checks: [{ photo_url: 'https://cdn.test/prova.jpg' }],
    proof_photo_url: 'https://cdn.test/prova.jpg',
  },
  reactions: {},
  user_reactions: [],
  latest_comments: [],
};

const comment = (id: string) => ({
  id,
  post_id: 'post-foto',
  user_id: 'user-x',
  content: 'boa!',
  created_at: '2026-08-03T09:20:00.000Z',
  user: { username: 'X', handle: 'x', avatar_url: null },
});

describe('feedPagePosts — os dois envelopes do servidor', () => {
  it('lê `posts`, que é o que `GET /rooms/:id/feed` devolve', () => {
    // Esta é a linha que estava quebrada: o cliente lia `.items` e recebia
    // `undefined`, o `.map()` estourava e o feed ficava vazio em silêncio.
    expect(feedPagePosts({ posts: [photoPost], total: 1, page: 1, limit: 20 }))
      .toEqual([photoPost]);
  });

  it('lê `items`, que é o que a rota de posts do membro devolve', () => {
    expect(feedPagePosts({ items: [sessionPost], total: 1, page: 1, limit: 20 }))
      .toEqual([sessionPost]);
  });

  it('não estoura com resposta ausente ou malformada', () => {
    expect(feedPagePosts(null)).toEqual([]);
    expect(feedPagePosts(undefined)).toEqual([]);
    expect(feedPagePosts({} as never)).toEqual([]);
  });
});

describe('roomFeedPostToCardPost — a foto', () => {
  it('MOSTRA a foto de um post avulso, mesmo com `show_proof_photo` falso', () => {
    // O defeito da `PLANO §Etapa 2`, travado: a flag governa a prova de sessão,
    // não a foto do post. Se isto voltar a `false`, todo check-in de foto cai
    // no ladrilho do coelho outra vez.
    const card = roomFeedPostToCardPost(photoPost, 'sala-1', 'user-ana');

    expect(photoPost.show_proof_photo).toBe(false); // é isto que o servidor manda
    expect(card.proof_photo_url).toBe(photoPost.photo_url);
    expect(card.show_proof_photo).toBe(true); // e é isto que a tela precisa
  });

  it('mostra a foto de prova de uma sessão', () => {
    const card = roomFeedPostToCardPost(sessionPost, 'sala-1', 'user-rod');
    expect(card.show_proof_photo).toBe(true);
    expect(card.proof_photo_url).toBe('https://cdn.test/prova.jpg');
  });

  it('não finge foto quando não há nenhuma', () => {
    const card = roomFeedPostToCardPost({ ...photoPost, photo_url: null });
    expect(card.show_proof_photo).toBe(false);
    expect(card.proof_photo_url).toBeNull();
  });
});

describe('roomFeedPostToCardPost — os campos do servidor', () => {
  it('traduz o post de sessão inteiro, do camelCase do Prisma', () => {
    const card = roomFeedPostToCardPost(sessionPost, 'ignorado', 'user-rod');

    expect(card).toMatchObject({
      id: 'post-sessao',
      kind: 'session',
      // `league_id` do post vence o `roomId` recebido: é a sala de verdade.
      league_id: 'sala-1',
      user_id: 'user-rod',
      username: 'Rodrigo',
      avatar_url: null,
      session_id: 'sess-1',
      subject_id: 'subj-calc',
      subject_name: 'Cálculo',
      subject_color: '#1680AF',
      total_duration_minutes: 47,
      // `xp_earned`, não `points_earned`: o pill do card lê "+N XP".
      points_earned: 120,
      is_verified: true,
      created_at: '2026-08-03T08:00:00.000Z',
      caption: null,
    });
  });

  it('usa `minutes`, já normalizado, e não o `Decimal` cru', () => {
    const card = roomFeedPostToCardPost(sessionPost);
    expect(card.total_duration_minutes).toBe(47);
    expect(typeof card.total_duration_minutes).toBe('number');
  });

  it('cai para o `roomId` recebido só quando o post não traz sala', () => {
    const card = roomFeedPostToCardPost({ ...photoPost, league_id: undefined as never }, 'sala-9');
    expect(card.league_id).toBe('sala-9');
  });

  it('um post avulso não vira sessão', () => {
    const card = roomFeedPostToCardPost(photoPost, 'sala-1', 'user-ana');
    expect(card.kind).toBe('standalone');
    expect(card.session_id).toBe('');
    expect(card.subject_name).toBe('');
    expect(card.total_duration_minutes).toBeUndefined();
    expect(card.points_earned).toBeUndefined();
    expect(card.is_verified).toBe(false);
  });

  it('não afirma desafio, porque o contrato não tem esse campo', () => {
    expect(roomFeedPostToCardPost(sessionPost).challenge_title).toBeUndefined();
  });
});

describe('roomFeedPostToCardPost — o fio é snake_case, sempre', () => {
  // Na fonte, `getLeagueFeed` escreve `user_reactions`/`latest_comments` e
  // `getChallengeMemberPosts` escreve `userReactions`/`latestComments`. Isso
  // não chega ao cliente: `SnakeCaseInterceptor` (registrado globalmente em
  // `apps/api/src/main.ts:53`) converte **toda** chave de **toda** resposta,
  // recursivamente. As duas grafias da fonte achatam para uma só aqui.
  it('lê as reações do próprio usuário de `user_reactions`', () => {
    const card = roomFeedPostToCardPost(photoPost, 'sala-1', 'user-ana');
    expect(card.reactions['🔥']).toContain('user-ana');
    expect(card.reactions['🔥']).toHaveLength(2);
  });

  it('sem `user_reactions`, ninguém aparece como tendo reagido', () => {
    const semMinhas: RoomFeedPost = { ...photoPost, user_reactions: undefined };
    const card = roomFeedPostToCardPost(semMinhas, 'sala-1', 'user-ana');
    expect(card.reactions['🔥']).not.toContain('user-ana');
    expect(card.reactions['🔥']).toHaveLength(2);
  });

  it('conta comentários por `latest_comments`; ausente é zero', () => {
    expect(roomFeedPostToCardPost({ ...photoPost, latest_comments: [comment('c1')] }).comment_count)
      .toBe(1);
    expect(roomFeedPostToCardPost({ ...photoPost, latest_comments: undefined }).comment_count)
      .toBe(0);
  });

  it('a contagem de comentários SATURA em 3 — o servidor faz `take: 3`', () => {
    // 3 aqui quer dizer "três ou mais". É a limitação do contrato, e está
    // travada por teste para ninguém a confundir com um total.
    const card = roomFeedPostToCardPost({
      ...photoPost,
      latest_comments: [comment('c1'), comment('c2'), comment('c3')],
    });
    expect(card.comment_count).toBe(3);
  });

  it('sobrevive a um post sem nenhum dos blocos opcionais', () => {
    const bare = {
      id: 'p',
      league_id: 'sala-1',
      user_id: 'u',
      created_at: '2026-08-03T09:00:00.000Z',
      user: { username: 'A', handle: 'a', avatar_url: null },
      session: null,
      caption: null,
      photo_url: null,
    } as unknown as RoomFeedPost;

    const card = roomFeedPostToCardPost(bare, 'sala-1', 'u');
    expect(card.reactions).toEqual({});
    expect(card.comment_count).toBe(0);
    expect(card.kind).toBe('standalone');
    expect(card.show_proof_photo).toBe(false);
  });
});
