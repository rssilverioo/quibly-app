/**
 * Non-color design tokens: type scale, spacing, radii, motion.
 *
 * These are deliberately short lists. If a screen needs a size that
 * isn't here, the screen is wrong — not the scale.
 */

import { FONTS } from '@quibly/shared/constants';

/**
 * Escala tipográfica. Nunito desde 02/08/2026, no lugar da Inter.
 *
 * A referência usa uma geométrica arredondada (família Nunito/Quicksand) e o
 * briefing manda copiar isso. Trocar a família não é trocar uma string: as
 * métricas reais dos dois arquivos, lidas do `hhea`/`OS/2` (normalizadas por
 * 1000 em):
 *
 *            ascender  descender  caixa natural  altura-x  caixa-alta
 *   Inter        969       -241        1,210em      545        727
 *   Nunito      1011       -353        1,364em      484        705
 *
 * Duas consequências, e as duas mexem em todo degrau:
 *
 * 1. **`lineHeight` subiu.** A caixa natural da Nunito é 12,7% maior que a da
 *    Inter. `lineHeight` abaixo dela faz o RN centralizar e cortar — e o corte
 *    aparece primeiro em português, no til de "Ã/Õ" e na perna do "g". Onde o
 *    texto é prosa, a linha ficou em ≥1,36×; onde é número (display, title1),
 *    fica mais apertada de propósito, porque dígito não tem descendente.
 * 2. **O tracking negativo caiu pela metade.** -2.5 e -1.4 foram calibrados
 *    para a Inter, que é estreita e de terminais retos. Numa arredondada os
 *    contornos já se tocam; o mesmo valor fecha o "o" e cola "rn" virando "m".
 *    Reduzido com critério, não zerado: o aperto óptico nos tamanhos grandes é
 *    o que separa "app moderno" de "React Native padrão", e isso continua.
 *
 * **Disciplina de uso (briefing §2.3): dois pesos, bold e regular.** Título,
 * nome e número usam bold; todo o resto é regular. `medium` e `semiBold`
 * continuam carregados e continuam nos degraus intermediários porque a Nunito
 * tem uma diferença de peso maior que a Inter entre 400 e 700 — mas ninguém
 * introduz um quinto uso. Peso não é hierarquia aqui; posição é.
 *
 * Chama-se `text` e não `type` porque `import { type as t }` colide com o
 * modificador `type` inline do TypeScript e faz parse ambíguo.
 */
export const text = {
  /** 64 — o número herói. Um por tela, no máximo. Só dígitos. */
  display: { fontSize: 64, lineHeight: 72, letterSpacing: -1.2, fontFamily: FONTS.bold },
  /** 40 — herói secundário */
  title1: { fontSize: 40, lineHeight: 50, letterSpacing: -0.7, fontFamily: FONTS.bold },
  /** 28 — título de tela (o tamanho do "Be-leaf in your roots" da referência) */
  title2: { fontSize: 28, lineHeight: 38, letterSpacing: -0.4, fontFamily: FONTS.bold },
  /** 20 — título de seção */
  title3: { fontSize: 20, lineHeight: 28, letterSpacing: -0.2, fontFamily: FONTS.semiBold },
  /** 16 — corpo */
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontFamily: FONTS.regular },
  /** 16 semibold — corpo enfatizado, título de item de lista */
  bodyStrong: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontFamily: FONTS.semiBold },
  /** 14 — texto secundário */
  label: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontFamily: FONTS.medium },
  /**
   * 12 — metadado, timestamp.
   *
   * O +0.1 de tracking não é enfeite: a altura-x da Nunito é 11% menor que a da
   * Inter, então 12px aqui lê como ~10,7px lá, e uma arredondada pequena e
   * apertada vira mancha. Dívida anotada: a referência põe metadado e pill em
   * 13–15px, e a leitura honesta é que `caption` devia ir a 13 e `label` a 15.
   * Não subi agora porque mexer em fontSize no meio da noite desloca a altura
   * de todo card que três devs estão montando neste instante. Fica para a
   * primeira revisão depois que as telas fecharem.
   */
  caption: { fontSize: 12, lineHeight: 17, letterSpacing: 0.1, fontFamily: FONTS.medium },
  /** 11 caixa alta — sobrancelha de seção (HOJE / ONTEM / DESAFIO ATIVO) */
  overline: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    fontFamily: FONTS.semiBold,
    textTransform: 'uppercase' as const,
  },
} as const;

/** 4-based spacing scale */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/**
 * Motion.
 *
 * Springs, not durations — duration-based easing is what makes an app
 * feel like a website. `snappy` for taps, `soft` for layout, `bouncy`
 * for anything celebratory.
 */
export const motion = {
  snappy: { damping: 20, stiffness: 320, mass: 0.8 },
  soft: { damping: 24, stiffness: 180, mass: 1 },
  bouncy: { damping: 12, stiffness: 220, mass: 0.9 },
  /** Only for opacity fades, where a spring is pointless */
  fade: { duration: 180 },
} as const;

/** Press feedback used across every tappable surface */
export const PRESS_SCALE = 0.97;

/**
 * Cores que o usuário escolhe para as próprias matérias.
 *
 * São *conteúdo*, não chrome — identificam uma matéria de relance e por isso
 * ficam de fora da paleta semântica de propósito. **Não colorem texto**
 * (`MARCA.md §4`): só o ponto de 8px do card e preenchimentos.
 *
 * **Reafinadas para o fundo claro em 02/08/2026.** As anteriores eram pasteis
 * de fundo escuro — `#C8FF4D` dava 1,1:1 sobre branco, ou seja, o ponto da
 * matéria simplesmente sumia. Cada uma foi rebaixada em luminância mantendo
 * matiz e saturação (teto de 78% para o conjunto não gritar), procurando a
 * janela em que a cor passa nos DOIS chãos. Resultado medido, contra `#FFFFFF`
 * e contra o `bg` escuro `#0A0A0C`:
 *
 *   lima      #5F8310  4,43 · 4,47      laranja   #B96017  4,42 · 4,47
 *   verde     #198942  4,47 · 4,43      âmbar     #977213  4,44 · 4,46
 *   céu       #1680AF  4,43 · 4,47      turquesa  #1B8678  4,44 · 4,45
 *   violeta   #815EEB  4,44 · 4,46      vermelho  #E52C2C  4,44 · 4,45
 *   rosa      #E21C83  4,44 · 4,45      índigo    #5D6AEB  4,44 · 4,45
 *
 * O pior caso sobre a `surface` escura (`#131318`) é 4,07:1 — folga confortável
 * sobre o mínimo de 3:1 de elemento não textual, nos dois modos. É uma lista
 * só, compartilhada pelos dois temas; não existe versão clara e versão escura.
 *
 * **A ordem é chave estrangeira, não gosto.** O banco guarda o índice, não o
 * hex: matéria criada com o índice 3 é a matéria "céu" de todo mundo. Reordenar
 * ou tirar uma cor daqui remapeia em silêncio a cor das matérias de todos os
 * usuários existentes. Dez cores, nesta ordem, para sempre — o que se pode
 * fazer é afinar o valor de cada posição, como foi feito aqui.
 */
export const SUBJECT_COLORS = [
  '#5F8310', '#198942', '#1680AF', '#815EEB', '#E21C83',
  '#B96017', '#977213', '#1B8678', '#E52C2C', '#5D6AEB',
] as const;
