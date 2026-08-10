import { describe, expect, it } from 'vitest';
import { converterChaves, paraCamel } from './camel';

/**
 * A fronteira entre a API e o painel.
 *
 * A API converte tudo para `snake_case` na saída; o painel foi escrito lendo
 * `camelCase`. Estes testes fixam a inversa, e em particular os dois casos que
 * causaram os defeitos relatados em 10/08: `_count`, que não pode ser mexido, e
 * arrays, cuja leitura errada derrubava a página inteira no `.map()`.
 */
describe('paraCamel', () => {
  it('converte o caso comum', () => {
    expect(paraCamel('avatar_url')).toBe('avatarUrl');
    expect(paraCamel('total_study_minutes')).toBe('totalStudyMinutes');
  });

  it('deixa em paz o que já está certo', () => {
    expect(paraCamel('email')).toBe('email');
    expect(paraCamel('avatarUrl')).toBe('avatarUrl');
  });

  it('preserva `_count` — era o campo que sumia', () => {
    /*
     Sem a âncora antes do `_`, `_count` viraria `Count` e o painel perderia
     todos os contadores de uma vez.
    */
    expect(paraCamel('_count')).toBe('_count');
  });

  it('lida com número antes do separador', () => {
    expect(paraCamel('total_q')).toBe('totalQ');
    expect(paraCamel('p95_ms')).toBe('p95Ms');
  });
});

describe('converterChaves', () => {
  it('desce em objetos aninhados', () => {
    const r = converterChaves<{ user: { avatarUrl: string } }>({
      user: { avatar_url: 'x' },
    });
    expect(r.user.avatarUrl).toBe('x');
  });

  it('converte dentro de `_count`, sem renomear `_count`', () => {
    // `_count.flashcard_sets` tem que virar `_count.flashcardSets`: a chave de
    // fora atravessa intacta, o conteúdo não.
    const r = converterChaves<{ _count: { flashcardSets: number } }>({
      _count: { flashcard_sets: 3 },
    });
    expect(r._count.flashcardSets).toBe(3);
  });

  it('converte dentro de arrays — era o que derrubava a tela', () => {
    /*
     O painel fazia `user.flashcardSets.map(...)`. Com a chave errada o array
     era `undefined` e a página inteira caía com "erro na rota".
    */
    const r = converterChaves<{ flashcardSets: Array<{ createdAt: string }> }>({
      flashcard_sets: [{ created_at: 'a' }, { created_at: 'b' }],
    });
    expect(r.flashcardSets.map((f) => f.createdAt)).toEqual(['a', 'b']);
  });

  it('null e undefined passam sem virar objeto', () => {
    expect(converterChaves(null)).toBeNull();
    expect(converterChaves(undefined)).toBeUndefined();
    expect(converterChaves({ current_period_end: null })).toEqual({
      currentPeriodEnd: null,
    });
  });

  it('primitivos atravessam', () => {
    expect(converterChaves(42)).toBe(42);
    expect(converterChaves('texto')).toBe('texto');
    expect(converterChaves(true)).toBe(true);
  });

  it('array na raiz é convertido item a item', () => {
    const r = converterChaves<Array<{ userId: string }>>([{ user_id: '1' }]);
    expect(r[0].userId).toBe('1');
  });

  it('a lista paginada do painel inteira', () => {
    // A forma real de `GET /admin/users`, que é o que a tela consome.
    const r = converterChaves<{
      items: Array<{ avatarUrl: string | null; totalXp: number }>;
      total: number;
    }>({
      items: [{ avatar_url: null, total_xp: 120 }],
      total: 1,
    });
    expect(r.items[0].totalXp).toBe(120);
    expect(r.items[0].avatarUrl).toBeNull();
    expect(r.total).toBe(1);
  });
});
