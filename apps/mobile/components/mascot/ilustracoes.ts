// `COELHOS` (assets/coelhos) sai do import enquanto a tabela está vazia — os
// arquivos continuam lá, e voltam junto com a primeira linha preenchida.
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
 * ## Por que a tabela está vazia agora
 *
 * Decisão do dono do produto em 10/08, e é de resolução, não de gosto.
 *
 * A folha de origem tem 1536x1024 para 16 coelhos — cerca de 300px cada. As
 * ilustrações foram normalizadas para 512x512, o que já é ampliação. A home
 * pede 150pt, e num aparelho 3x isso são 450px de fonte: ali amolece.
 *
 * Foram três tentativas de conseguir a arte melhor. Um SVG traçado pelo
 * `imagetracer.js` (duas cores, um borrão) e dez SVG que embrulhavam a **mesma
 * folha** em base64, com o raster idêntico pixel a pixel ao PNG original —
 * conferido por hash. Não havia resolução escondida em lugar nenhum.
 *
 * Então o vetor volta a atender tudo: ele é nítido em qualquer tamanho,
 * acompanha o tema e cobre os 30 estados. Os arquivos ficam em `assets/`, e a
 * arquitetura fica de pé — esta tabela funciona igual com PNG ou com SVG. No
 * dia em que a arte vier em resolução maior, volta a ser preencher linhas.
 */
export const ILUSTRACAO: Partial<Record<MascotState, number>> = {
  // Vazio de propósito. Ver acima. Preencher aqui é o suficiente para a
  // ilustração voltar a todas as telas que usam aquele estado.
};
