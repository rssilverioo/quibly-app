import { describe, expect, it } from 'vitest';
import { ordinal } from './ordinal';

describe('ordinal', () => {
  it('uses the masculine ordinal marker in Portuguese', () => {
    expect(ordinal(1, 'pt-BR')).toBe('1º');
    expect(ordinal(11, 'pt-BR')).toBe('11º');
    expect(ordinal(23, 'pt')).toBe('23º');
  });

  it('picks the English suffix by last digit', () => {
    expect(ordinal(1, 'en')).toBe('1st');
    expect(ordinal(2, 'en')).toBe('2nd');
    expect(ordinal(3, 'en')).toBe('3rd');
    expect(ordinal(4, 'en')).toBe('4th');
    expect(ordinal(21, 'en-US')).toBe('21st');
  });

  it('handles the teens, which do not follow the last digit', () => {
    // The rule everyone gets wrong: 11/12/13 are th, not st/nd/rd.
    expect(ordinal(11, 'en')).toBe('11th');
    expect(ordinal(12, 'en')).toBe('12th');
    expect(ordinal(13, 'en')).toBe('13th');
    expect(ordinal(111, 'en')).toBe('111th');
    expect(ordinal(112, 'en')).toBe('112th');
  });

  it('falls back to English for an unknown locale', () => {
    expect(ordinal(1, 'fr')).toBe('1st');
  });
});
