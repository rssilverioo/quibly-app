import { COELHOS } from '../../assets/coelhos';
import type { MascotState } from './Mascot';

/**
 * Onde a ilustração substitui o desenho vetorial — **e onde não substitui**.
 *
 * ## Por que uma tabela, e não 34 edições
 *
 * O mascote é chamado em 34 lugares, e nove deles escolhem a pose em tempo de
 * execução. Trocar chamada por chamada exigiria decidir 34 vezes a mesma coisa
 * e deixaria os nove dinâmicos de fora. Aqui a decisão é por **estado**: quando
 * uma ilustração entrar nesta tabela, toda tela que usa aquele estado passa a
 * mostrá-la, inclusive as dinâmicas.
 *
 * ## Por que não perde a animação
 *
 * O `<Svg>` do mascote mora dentro de um `<Animated.View>` — o movimento
 * (respirar, pular, pulsar, balançar) é do contêiner, não da figura. A imagem
 * entra no mesmo lugar e herda tudo. Era a objeção óbvia à troca, e ela não se
 * sustenta.
 *
 * ## Por que a tabela é curta de propósito
 *
 * São 30 estados e 16 ilustrações, e o encaixe **não é** um para um. Só entram
 * pares fiéis: `reading` com o coelho lendo é fiel; `worried` com o coelho em
 * pânico não é — um berro de mãos na cabeça numa tela que diz "você ainda não
 * entrou em nenhuma sala" assusta em vez de acolher, e `worried` é o estado
 * mais usado do app, com nove chamadas.
 *
 * Uma pose quase certa é pior que o vetor: o vetor é neutro, e o quase certo
 * chama atenção para o erro. Por isso o que falta fica de fora, e o mascote
 * vetorial continua atendendo — não existe tela sem coelho por causa disto.
 *
 * As poses que faltam desenhar, em ordem de uso real: `worried` (9), `wave`
 * (2), `idle` (2). Quando existirem, é aqui que entram.
 *
 * ## Por que a tabela esteve vazia de 10/08 a 22/09
 *
 * A folha de origem tinha 1536x1024 para 16 coelhos — cerca de 300px cada,
 * normalizados para 512. A home pede 150pt, que num aparelho 3x são 450px:
 * ali amolecia. Três tentativas de achar resolução escondida (traçado por
 * `imagetracer.js`, SVG embrulhando o mesmo raster) não acharam nada, e o
 * vetor voltou a atender tudo. Em 22/09 a arte chegou em 1254px, e preencher
 * as linhas abaixo foi o suficiente para ela voltar a todas as telas.
 */
export const ILUSTRACAO: Partial<Record<MascotState, number>> = {
  // 22/09/2026: a arte veio em 1254px, e a tabela voltou a ser preenchida.
  // Só pares fiéis. O que não está aqui continua no vetor — em especial
  // `worried`, o estado mais usado, que ainda não tem pose desenhada.
  idle: COELHOS.idle,
  wave: COELHOS.wave,
  happy: COELHOS.happy,
  celebrate: COELHOS.celebrate,
  star: COELHOS.star,
  listening: COELHOS.listening,
  thinking: COELHOS.thinking,
  working: COELHOS.working,
  searching: COELHOS.searching,
  reading: COELHOS.reading,
  graduate: COELHOS.graduate,
  focused: COELHOS.focused,
  sleepy: COELHOS.sleepy,
  break: COELHOS.break,
  love: COELHOS.love,
};
