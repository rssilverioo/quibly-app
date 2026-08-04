/**
 * A geometria da capa da sala.
 *
 * Vive aqui, e não junto das imagens, por uma razão prática: o módulo de
 * `assets/room-covers` faz `require` de PNG e por isso não pode ser importado
 * por teste. Regra que vale além deste caso — lógica que se quer testar não
 * mora ao lado de binário.
 */

/** A capa é uma FAIXA, não um plano de fundo. Medida na referência. */
export const ROOM_COVER_ASPECT_RATIO = 2.5;

/** Teto da faixa, em pontos. */
export const ROOM_COVER_MAX_HEIGHT = 150;

/**
 * A altura da capa, calculada — nunca deixada para o `aspectRatio` do Yoga.
 *
 * O estilo natural seria `{ width: '100%', aspectRatio, maxHeight }`, e ele tem
 * um defeito que **só aparece quando o teto morde**: o Yoga trava a altura em
 * 150, encolhe a **largura** para preservar a proporção (150 × 2,5 = 375, e a
 * capa deixa de encostar na borda direita) e ainda infla a altura do elemento
 * **pai**.
 *
 * Medido em 04/08/2026 na tela da sala, com `onLayout`, num iPhone 17 Pro Max:
 * o card do topo tinha **871pt** com a capa e **78pt** sem ela, enquanto a
 * própria capa relatava 150. Os ~660pt de vazio empurravam o feed inteiro para
 * fora da primeira tela — a sala parecia vazia mesmo tendo posts.
 *
 * Por que ninguém tinha visto: numa janela de 393pt a conta dá 144, abaixo do
 * teto, e nada acontece. O defeito nasce a partir de 375pt de largura útil
 * (2,5 × 150), que é quando o teto começa a agir.
 *
 * `larguraDisponivel` é a largura de dentro do card — desconte o recuo da tela
 * e as bordas antes de chamar.
 */
export function roomCoverHeight(larguraDisponivel: number): number {
  return Math.min(larguraDisponivel / ROOM_COVER_ASPECT_RATIO, ROOM_COVER_MAX_HEIGHT);
}
