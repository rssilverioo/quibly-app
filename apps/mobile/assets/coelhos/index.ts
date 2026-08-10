/**
 * Os coelhos ilustrados, recortados da folha de 10/08/2026.
 *
 * São PNG com alfa, entre 190 e 400px de largura — tamanho de desenho, não de
 * ícone. Servem para os momentos em que o coelho **é** a tela: estado vazio,
 * boas-vindas, conquista. Para o que precisa animar, mudar com o tema ou
 * escolher a pose em tempo de execução, o mascote em SVG (`components/mascot`)
 * continua sendo o certo — ver o comentário lá.
 *
 * O `require` precisa ser literal: o empacotador do Metro resolve os caminhos
 * em tempo de build, e um `require(variável)` não existe no bundle. Por isso
 * este arquivo é gerado a partir da pasta, e não montado com um laço.
 */
export const COELHOS = {
  abracando_coracao: require('./coelho-abracando-coracao.png'),
  celular_quibly: require('./coelho-celular-quibly.png'),
  checklist: require('./coelho-checklist.png'),
  comemorando: require('./coelho-comemorando.png'),
  correndo_cafe: require('./coelho-correndo-cafe.png'),
  correndo_faixa: require('./coelho-correndo-faixa.png'),
  dormindo: require('./coelho-dormindo.png'),
  espiando: require('./coelho-espiando.png'),
  estudando_fones: require('./coelho-estudando-fones.png'),
  joinha: require('./coelho-joinha.png'),
  lendo_livro: require('./coelho-lendo-livro.png'),
  mochila_coracao: require('./coelho-mochila-coracao.png'),
  notebook: require('./coelho-notebook.png'),
  oculos_puff: require('./coelho-oculos-puff.png'),
  panico: require('./coelho-panico.png'),
  trofeu: require('./coelho-trofeu.png'),
} as const;

export type Coelho =
  | 'abracando_coracao'
  | 'celular_quibly'
  | 'checklist'
  | 'comemorando'
  | 'correndo_cafe'
  | 'correndo_faixa'
  | 'dormindo'
  | 'espiando'
  | 'estudando_fones'
  | 'joinha'
  | 'lendo_livro'
  | 'mochila_coracao'
  | 'notebook'
  | 'oculos_puff'
  | 'panico'
  | 'trofeu';
