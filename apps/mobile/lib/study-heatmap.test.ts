import { describe, expect, it } from 'vitest';
import { diasComEstudo, montarSemanas, nivelDeEstudo } from './study-heatmap';

/**
 * O mapa de constância erra em silêncio: um dia a mais no começo desloca a
 * semana inteira, e ninguém confere quadradinho por quadradinho olhando a tela.
 * Por isso a aritmética de calendário é testada, e não só desenhada.
 */
describe('nivelDeEstudo', () => {
  it('uses pomodoro multiples, not quartiles', () => {
    // Quartil faria o mesmo dia mudar de cor conforme os OUTROS dias do mês.
    // Aqui 50 minutos são sempre o mesmo tom.
    expect(nivelDeEstudo(0)).toBe(0);
    expect(nivelDeEstudo(24)).toBe(1);
    expect(nivelDeEstudo(25)).toBe(2);
    expect(nivelDeEstudo(99)).toBe(3);
    expect(nivelDeEstudo(100)).toBe(4);
    expect(nivelDeEstudo(600)).toBe(4);
  });

  it('treats a missing or negative day as empty', () => {
    expect(nivelDeEstudo(-1)).toBe(0);
  });
});

describe('montarSemanas', () => {
  it('starts every column on a Sunday, padding the first week', () => {
    // 2026-08-05 é uma quarta-feira. A primeira coluna precisa recuar até
    // domingo 02/08, senão as linhas deixam de ser dias da semana.
    const semanas = montarSemanas('2026-08-05', '2026-08-08', {});
    expect(semanas[0][0].data).toBe('2026-08-02');
    expect(semanas[0][0].preenchimento).toBe(true);
    expect(semanas[0][3].data).toBe('2026-08-05');
    expect(semanas[0][3].preenchimento).toBe(false);
  });

  it('keeps seven rows per full column', () => {
    const semanas = montarSemanas('2026-01-01', '2026-12-31', {});
    for (const semana of semanas.slice(0, -1)) expect(semana).toHaveLength(7);
  });

  it('ends on the requested day, even mid-week', () => {
    const semanas = montarSemanas('2026-08-05', '2026-08-06', {});
    const ultimo = semanas.at(-1)!.at(-1)!;
    expect(ultimo.data).toBe('2026-08-06');
  });

  it('fills minutes only where the server reported them', () => {
    const semanas = montarSemanas('2026-08-05', '2026-08-08', {
      '2026-08-06': 47,
    });
    const dias = semanas.flat();
    expect(dias.find((d) => d.data === '2026-08-06')?.nivel).toBe(2);
    expect(dias.find((d) => d.data === '2026-08-07')?.minutos).toBe(0);
  });

  it('does not count padding days as studied', () => {
    // O domingo de recuo poderia ter estudo de antes da janela — ele aparece
    // apagado, mas não pode entrar na contagem que a legenda mostra.
    const semanas = montarSemanas('2026-08-05', '2026-08-08', {
      '2026-08-02': 120,
      '2026-08-06': 30,
    });
    expect(diasComEstudo(semanas)).toBe(1);
  });

  it('returns nothing when the window is inverted', () => {
    expect(montarSemanas('2026-08-08', '2026-08-05', {})).toEqual([]);
  });
});
