/**
 * Os coelhos ilustrados, recortados da folha de 10/08/2026.
 *
 * São PNG com alfa, todos **512x512**, e isso é deliberado nas duas coisas.
 *
 * Quadrados porque o recorte original ia de 192x322 a 396x265 — proporções de
 * 0,60 a 1,49. Num quadro quadrado, com `contain`, cada um renderizava num
 * tamanho visual diferente: o largo ficava baixinho, o estreito ficava magro.
 * Era isso o "ficou tudo feio", e não o formato.
 *
 * 512 porque a maior chamada pede 150pt, o que num aparelho 3x são 450px.
 * Menos que isso amolece.
 *
 * Dentro do quadro, cada pose foi escalada para ter a **mesma área opaca** —
 * peso visual igual, que é o que o olho compara. Igualar pela altura faria o
 * coelho deitado virar um bicho gigante deitado.
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
