import type { ImageSourcePropType } from 'react-native';

/**
 * O azul que fica **atrás** da fotografia.
 *
 * Continua sendo o mesmo do splash nativo (`SplashScreenBackground` no iOS,
 * `colors.xml` no Android) porque ele ainda é o primeiro quadro: enquanto o
 * JPEG não decodifica, é esta cor que a tela mostra. Ela deixou de ser o fundo
 * das ilustrações — que agora são fotográficas e cobrem tudo — e passou a ser
 * só o piso, mas justamente por isso não pode mudar.
 */
export const AZUL_ABERTURA = '#015FFD';

/**
 * As cidades. `require` estático de propósito: o Metro resolve o caminho em
 * tempo de build, então nada de montar o nome do arquivo por interpolação.
 */
const CIDADES: ImageSourcePropType[] = [
  require('../assets/splash-cities/los-angeles.jpg'),
  require('../assets/splash-cities/new-york.jpg'),
  require('../assets/splash-cities/san-francisco.jpg'),
];

/**
 * A cidade da vez — sorteada **uma vez por abertura do app**.
 *
 * ## Por que módulo, e não `useMemo` dentro do componente
 *
 * A escolha antes vivia num `useMemo(..., [])` do `CitySplash`. Isso bastava
 * enquanto só o splash mostrava a foto. Agora o login mostra a mesma imagem, e
 * as duas telas são componentes diferentes: cada `useMemo` sortearia por conta
 * própria, e o app abriria em Nova York para trocar para São Francisco no
 * instante em que a autenticação terminasse de carregar.
 *
 * No escopo do módulo, o sorteio acontece uma vez no ciclo de vida do bundle e
 * as duas telas leem o mesmo valor. É o menor lugar onde a decisão pode viver
 * e ainda ser compartilhada.
 */
export const cidadeDaAbertura: ImageSourcePropType =
  CIDADES[Math.floor(Math.random() * CIDADES.length)];

/**
 * Quando o bundle subiu — o zero da aproximação.
 *
 * ## O problema que este relógio resolve
 *
 * A câmera se aproxima da cidade devagar, e essa aproximação atravessa **duas
 * telas**: começa no `CitySplash` e continua no login. Só que o splash
 * desmonta e o login monta — se cada um animasse de `1` até `1.14` por conta
 * própria, a imagem daria um salto para trás no exato quadro da troca, que é
 * o defeito mais visível que uma transição pode ter.
 *
 * Com um instante de referência fixo, a escala não é um estado da tela: é uma
 * função do tempo decorrido. Quem monta depois entra no meio da curva, no
 * ponto exato em que o anterior parou. A troca de tela deixa de existir para
 * quem olha.
 *
 * É o mesmo raciocínio de `StudyTimerAttributes`: quando duas superfícies
 * precisam concordar sobre um valor que anda com o relógio, o que se
 * compartilha é o carimbo de tempo, não o valor.
 */
export const INICIO_DA_ABERTURA = Date.now();

/** Onde a câmera começa. Acima de 1 para não deixar borda em nenhuma razão. */
export const ZOOM_INICIAL = 1.02;
/** Onde ela para. Mais que isso e a foto começa a perder definição. */
export const ZOOM_FINAL = 1.16;
/** Lenta de propósito: aproximação percebida, não movimento notado. */
export const ZOOM_DURACAO_MS = 16000;

/** Quanto da aproximação já passou, de 0 a 1. */
export function progressoDaAproximacao(): number {
  const decorrido = Date.now() - INICIO_DA_ABERTURA;
  return Math.min(1, Math.max(0, decorrido / ZOOM_DURACAO_MS));
}

/** A escala da imagem neste instante, para quem estiver montando agora. */
export function escalaDaAproximacao(): number {
  return ZOOM_INICIAL + (ZOOM_FINAL - ZOOM_INICIAL) * progressoDaAproximacao();
}

/** Quanto falta de aproximação, para o `withTiming` de quem monta no meio. */
export function restanteDaAproximacaoMs(): number {
  return Math.max(0, ZOOM_DURACAO_MS * (1 - progressoDaAproximacao()));
}
