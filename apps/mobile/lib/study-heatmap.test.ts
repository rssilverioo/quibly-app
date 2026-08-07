import { describe, expect, it } from 'vitest';
import { diasComEstudo, montarSemanas, nivelDeEstudo, rotulosDeMes } from './study-heatmap';

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
  /**
   * A premissa que decide o que "mapa invisível" significa.
   *
   * O componente já tratava grade vazia como "esta conta nunca estudou" e sumia.
   * Não é isso: sem nenhum dia estudado a grade sai **inteira**, só cinza. O
   * único jeito de ela sair vazia é a janela vir invertida, que é defeito de
   * servidor — nunca "usuário novo". Se este teste cair, a regra de visibilidade
   * do `StudyHeatmap` perde o chão.
   */
  it('desenha a grade inteira mesmo sem nenhum dia de estudo', () => {
    const semanas = montarSemanas('2025-08-01', '2026-08-06', {});

    expect(semanas.length).toBeGreaterThan(50);
    expect(diasComEstudo(semanas)).toBe(0);
  });

  it('só devolve vazio quando a janela vem invertida', () => {
    expect(montarSemanas('2026-08-06', '2026-08-01', {})).toEqual([]);
  });

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

describe('rotulosDeMes', () => {
  it('marks the column where each month first appears', () => {
    const semanas = montarSemanas('2026-01-01', '2026-06-30', {});
    const meses = rotulosDeMes(semanas).map((r) => r.mes);
    // Janeiro a junho, em ordem e sem repetir.
    expect(meses).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('puts each label on a column that really belongs to that month', () => {
    const semanas = montarSemanas('2026-01-01', '2026-12-31', {});
    for (const { coluna, mes } of rotulosDeMes(semanas)) {
      // O rótulo não pode apontar para uma coluna cujo mês é outro — foi o
      // erro clássico de rotular pelo índice da semana em vez da data dela.
      const mesesDaColuna = semanas[coluna].map((d) => Number(d.data.slice(5, 7)) - 1);
      expect(mesesDaColuna).toContain(mes);
    }
  });

  it('always labels the last month, even in a single column', () => {
    // A janela acaba no dia 2 de setembro, então "set" ocupa uma coluna só. A
    // grade abre no fim: é o primeiro mês que o olho encontra, e era justamente
    // o que a regra antiga descartava por falta de espaço.
    const semanas = montarSemanas('2026-06-01', '2026-09-02', {});
    expect(rotulosDeMes(semanas).map((r) => r.mes)).toContain(8);
  });

  it('does not stack two labels on top of each other at the left edge', () => {
    const semanas = montarSemanas('2026-01-30', '2026-05-31', {});
    const colunas = rotulosDeMes(semanas).map((r) => r.coluna);
    for (let i = 1; i < colunas.length; i++) {
      expect(colunas[i] - colunas[i - 1]).toBeGreaterThanOrEqual(3);
    }
  });

  it('has nothing to label when there are no weeks', () => {
    expect(rotulosDeMes([])).toEqual([]);
  });
});
