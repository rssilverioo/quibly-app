import { describe, expect, it } from 'vitest';

import { resumirODia } from './dia-de-estudo';

const mapa = (dias: Record<string, number>) => ({
  from: '2026-08-03',
  to: '2026-08-09',
  days: Object.entries(dias).map(([date, minutes]) => ({ date, minutes })),
}) as never;

const AGORA = new Date(2026, 7, 9); // 9 de agosto de 2026, um domingo

describe('resumirODia', () => {
  it('mede hoje contra a meta', () => {
    const r = resumirODia(mapa({ '2026-08-09': 18 }), 30, AGORA);
    expect(r.minutosHoje).toBe(18);
    expect(r.faltamMinutos).toBe(12);
    expect(r.cumpriu).toBe(false);
    expect(r.progresso).toBeCloseTo(0.6);
  });

  it('satura o progresso em 1 e zera o que falta', () => {
    // Sem saturar, uma barra desenhada com `flex` de 3.3 estouraria o cartão.
    const r = resumirODia(mapa({ '2026-08-09': 100 }), 30, AGORA);
    expect(r.progresso).toBe(1);
    expect(r.faltamMinutos).toBe(0);
    expect(r.cumpriu).toBe(true);
  });

  it('monta sete dias mesmo quando quase nenhum tem estudo', () => {
    // A resposta traz só os dias COM estudo. Montar a semana a partir da lista
    // a faria encolher justamente nos dias parados — que é a informação que
    // mais interessa mostrar.
    const r = resumirODia(mapa({ '2026-08-07': 40 }), 30, AGORA);
    expect(r.semana).toHaveLength(7);
    expect(r.semana.map((d) => d.data)).toEqual([
      '2026-08-03', '2026-08-04', '2026-08-05',
      '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09',
    ]);
    expect(r.semana.filter((d) => d.minutos > 0)).toHaveLength(1);
  });

  it('marca hoje como o último da semana, e só ele', () => {
    const r = resumirODia(mapa({}), 30, AGORA);
    expect(r.semana.filter((d) => d.hoje)).toHaveLength(1);
    expect(r.semana[6].hoje).toBe(true);
  });

  it('meta zero vira 15, senão a barra nasce cheia', () => {
    // Conta antiga pode ter `daily_goal_minutes: 0`. Sem piso, dividir por zero
    // daria `Infinity`, e a tela diria "dia cumprido" para quem não estudou.
    const r = resumirODia(mapa({}), 0, AGORA);
    expect(r.metaMinutos).toBe(15);
    expect(r.cumpriu).toBe(false);
    expect(Number.isFinite(r.progresso)).toBe(true);
  });

  it('conta dias estudados, e não blocos de pomodoro', () => {
    // O número na tela era `Math.ceil(minutosTotais / 25)`: 17h viravam "41
    // dias estudados", que é a contagem de pomodoros.
    const r = resumirODia(
      mapa({ '2026-08-05': 300, '2026-08-07': 40, '2026-08-09': 18 }),
      30,
      AGORA,
    );
    expect(r.diasEstudados).toBe(3);
  });

  it('sobrevive ao mapa ausente, que é o primeiro quadro da tela', () => {
    const r = resumirODia(null, 30, AGORA);
    expect(r.minutosHoje).toBe(0);
    expect(r.semana).toHaveLength(7);
    expect(r.diasEstudados).toBe(0);
  });
});

describe('os minutos aparecem inteiros', () => {
  it('arredonda o que veio do servidor em fração', () => {
    // A sessão é medida em segundos, então o mapa devolve `2.2666…`. A tela
    // mostrava "2.27 de 15 min" e "faltam 12.73 min" — precisão que ninguém
    // usa e que faz o número parecer instrumento de laboratório.
    const r = resumirODia(mapa({ '2026-08-09': 2.2666 }), 15, AGORA);
    expect(r.minutosHoje).toBe(2);
    expect(r.faltamMinutos).toBe(13);
    expect(Number.isInteger(r.minutosHoje)).toBe(true);
    expect(Number.isInteger(r.faltamMinutos)).toBe(true);
  });
});
