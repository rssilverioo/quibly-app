/**
 * A cor que fica atrás de tudo na abertura.
 *
 * É o `bg` do tema claro (`theme/colors.ts`) copiado como literal, e precisa
 * ser literal: o splash nativo lê esta cor de três lugares fora do JS
 * (`app.json`, o colorset do iOS e o `colors.xml` do Android), e o teste em
 * `lib/abertura.test.ts` confere que os quatro concordam. Uma diferença de um
 * tom aparece como um piscar no quadro em que o nativo dá lugar ao JS.
 *
 * ## Por que claro, e não mais o azul
 *
 * Até 21/09/2026 a abertura era azul `#015FFD` com uma fotografia de cidade
 * americana e o coelho colado por cima, e o login era um painel de vidro
 * escuro sobre a mesma foto. Eram três estilos em três segundos — chapado,
 * fotográfico, e então o app claro do GymRats. A abertura prometia uma coisa
 * e o app entregava outra. Agora o primeiro quadro já é o app.
 */
export const COR_DA_ABERTURA = '#F7F7F9';

/** O azul do coelho e do wordmark na abertura: o `accent` do tema claro. */
export const AZUL_DA_MARCA = '#0043BA';

/**
 * A arte do splash nativo — o coelho correndo, branco com contorno azul,
 * num quadrado de 1284px. A tela de abertura em JS mostra **a mesma imagem**
 * na **mesma posição** em que o nativo a deixou, então a passagem de um para
 * o outro não é uma troca: é a interface aparecendo em volta de um coelho
 * que já estava lá.
 */
export const COELHO_DA_ABERTURA = require('../assets/splash.png');
