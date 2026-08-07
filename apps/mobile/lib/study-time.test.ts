import { describe, expect, it } from 'vitest';
import { formatarTempoDeEstudo } from './study-time';

describe('formatarTempoDeEstudo', () => {
  it('conta em minutos até fechar a hora', () => {
    expect(formatarTempoDeEstudo(1)).toBe('1m');
    expect(formatarTempoDeEstudo(45)).toBe('45m');
    expect(formatarTempoDeEstudo(59)).toBe('59m');
  });

  it('passa a contar em horas a partir de 60', () => {
    expect(formatarTempoDeEstudo(60)).toBe('1h');
    expect(formatarTempoDeEstudo(61)).toBe('1h 1m');
    expect(formatarTempoDeEstudo(1017)).toBe('16h 57m');
  });

  it('omite o resto na hora cheia, em vez de escrever "16h 0m"', () => {
    expect(formatarTempoDeEstudo(120)).toBe('2h');
  });

  /**
   * O defeito que apareceu na tela: `totalDurationMinutes` é Decimal no Prisma e
   * chega em ponto flutuante, então `1017.1200000000001 % 60` imprimia
   * `57.1200000000000005m` para o usuário.
   */
  it('nunca deixa ponto flutuante vazar para a tela', () => {
    expect(formatarTempoDeEstudo(1017.1200000000001)).toBe('16h 57m');
    expect(formatarTempoDeEstudo(0.30000000000000004)).toBe('0m');
    expect(formatarTempoDeEstudo(44.7)).toBe('45m');
  });

  it('arredonda o total, e não cada parcela — 59,6 vira 1h e não "0h 60m"', () => {
    expect(formatarTempoDeEstudo(59.6)).toBe('1h');
  });

  it('não quebra com ausência de dado', () => {
    expect(formatarTempoDeEstudo(0)).toBe('0m');
    expect(formatarTempoDeEstudo(-5)).toBe('0m');
    expect(formatarTempoDeEstudo(Number.NaN)).toBe('0m');
  });
});
