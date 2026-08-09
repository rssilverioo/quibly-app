import { describe, expect, it } from 'vitest';

import { autorDoComentario } from './comentario-autor';

describe('autorDoComentario', () => {
  it('lê `user`, que é o que a API manda de verdade', () => {
    // Este caso é o defeito: o card lia `username`/`profile` e caía em
    // "desconhecido" para **todo** comentário, porque o Prisma junta em `user`.
    expect(
      autorDoComentario({
        user: { username: 'Rodrigo', avatar_url: 'https://cdn/r.jpg', plan: 'PRO' },
      }),
    ).toEqual({ nome: 'Rodrigo', avatar: 'https://cdn/r.jpg', pro: true });
  });

  it('aceita os campos planos e `profile`, que o tipo compartilhado promete', () => {
    expect(autorDoComentario({ username: 'Ana', avatar_url: null })).toEqual({
      nome: 'Ana',
      avatar: null,
      pro: false,
    });
    expect(autorDoComentario({ profile: { username: 'Bia', plan: 'PRO' } })).toEqual({
      nome: 'Bia',
      avatar: null,
      pro: true,
    });
  });

  it('`user` ganha dos outros dois quando os três vêm', () => {
    expect(
      autorDoComentario({
        user: { username: 'novo' },
        username: 'plano',
        profile: { username: 'velho' },
      }).nome,
    ).toBe('novo');
  });

  it('devolve nome nulo em vez de um rótulo, para quem desenha traduzir', () => {
    expect(autorDoComentario({})).toEqual({ nome: null, avatar: null, pro: false });
  });

  it('só `PRO` vira escudo — plano ausente ou `FREE` não', () => {
    expect(autorDoComentario({ user: { plan: 'FREE' } }).pro).toBe(false);
    expect(autorDoComentario({ user: {} }).pro).toBe(false);
  });
});
