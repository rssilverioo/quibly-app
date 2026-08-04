import { describe, expect, it } from 'vitest';
import {
  ROOM_COVER_ASPECT_RATIO,
  ROOM_COVER_MAX_HEIGHT,
  roomCoverHeight,
} from './room-cover';

/**
 * A altura da capa é calculada em vez de deixada para o `aspectRatio` do Yoga.
 *
 * O estilo natural — `{ width: '100%', aspectRatio, maxHeight }` — quebra
 * exatamente quando o teto morde: o Yoga trava a altura, encolhe a **largura**
 * para preservar a proporção e infla a altura do **pai**. Na tela da sala isso
 * dava um card de 871pt em vez de 208, com ~660pt de vazio que empurravam o
 * feed inteiro para fora da primeira tela.
 *
 * O que este teste protege não é a aritmética, que é trivial — é a fronteira.
 * Um aparelho estreito nunca teria mostrado o defeito, e foi por isso que ele
 * viveu tanto tempo.
 */
describe('roomCoverHeight', () => {
  it('keeps the 2.5 band on a narrow phone, where the cap never bites', () => {
    // iPhone 15/16/17 base: 393pt de janela → 359 dentro do card.
    expect(roomCoverHeight(359)).toBeCloseTo(359 / ROOM_COVER_ASPECT_RATIO, 5);
    expect(roomCoverHeight(359)).toBeLessThan(ROOM_COVER_MAX_HEIGHT);
  });

  it('caps on a wide phone instead of shrinking the cover sideways', () => {
    // iPhone 17 Pro Max: 440pt de janela → 406 dentro do card. 406/2,5 = 162,4.
    expect(roomCoverHeight(406)).toBe(ROOM_COVER_MAX_HEIGHT);
  });

  it('never returns more than the cap, however wide the screen', () => {
    // O iPad é o caso extremo, e é onde o defeito era mais grosseiro.
    expect(roomCoverHeight(1000)).toBe(ROOM_COVER_MAX_HEIGHT);
  });

  it('places the boundary where the cap starts to bite', () => {
    const fronteira = ROOM_COVER_MAX_HEIGHT * ROOM_COVER_ASPECT_RATIO;
    expect(roomCoverHeight(fronteira)).toBe(ROOM_COVER_MAX_HEIGHT);
    expect(roomCoverHeight(fronteira - 1)).toBeLessThan(ROOM_COVER_MAX_HEIGHT);
  });
});
