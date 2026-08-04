import { describe, expect, it } from 'vitest';
import { diasAte, emDias, PRAZO_MAXIMO_DIAS } from './prazo-desafio';

/**
 * A régua de 7/14/30 cobre o caso comum; o calendário cobre o resto. O que este
 * teste protege é a conversão, porque data é onde erro nasce em silêncio — um
 * dia a mais ou a menos não quebra nada visível, só encerra o desafio na hora
 * errada.
 */
describe('diasAte', () => {
  const agora = new Date('2026-08-04T22:40:00');

  it('ignores the time of day the room was created', () => {
    // Criar a sala às 22h40 não pode custar um dia: os dois lados vão para
    // meia-noite antes da subtração.
    expect(diasAte(new Date('2026-08-11T00:00:00'), agora)).toBe(7);
    expect(diasAte(new Date('2026-08-11T23:59:00'), agora)).toBe(7);
  });

  it('never returns less than a day', () => {
    // Desafio que termina hoje nasceria encerrado.
    expect(diasAte(new Date('2026-08-04T23:00:00'), agora)).toBe(1);
    expect(diasAte(new Date('2026-07-01T00:00:00'), agora)).toBe(1);
  });

  it('caps at the same ceiling the DTO enforces', () => {
    expect(diasAte(new Date('2030-01-01T00:00:00'), agora)).toBe(PRAZO_MAXIMO_DIAS);
  });

  it('agrees with emDias, which is what seeds the picker', () => {
    expect(diasAte(emDias(45))).toBe(45);
    expect(diasAte(emDias(1))).toBe(1);
  });
});
