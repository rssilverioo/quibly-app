import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tela = readFileSync(
  new URL('../app/league/post/[id].tsx', import.meta.url).pathname,
  'utf8',
);
const codigo = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * A tela de compor foi redesenhada a partir da referência do GymRats: a mídia
 * vira o objeto central e o contexto a ladeia. Estes testes travam as decisões
 * que uma edição distraída desfaz sem parecer errado.
 */
describe('check-in — estrutura', () => {
  it('o quadro da mídia existe mesmo sem foto', () => {
    // O defeito anterior: dois botões que sumiam ao escolher a foto, e a tela
    // mudava de forma no meio da tarefa. O quadro é sempre desenhado; só o
    // conteúdo dele é condicional.
    const quadro = codigo.indexOf('styles.quadro');
    const condicional = codigo.indexOf('photo ?', quadro);

    expect(quadro).toBeGreaterThan(-1);
    // O ternário do conteúdo vem DEPOIS da abertura do quadro, não em volta.
    expect(condicional).toBeGreaterThan(quadro);
    expect(codigo).toContain("t('rooms.noMedia')");
  });

  /**
   * O gesto grande serve a ação principal.
   *
   * Antes, tocar o quadro abria a galeria e o lápis abria a câmera só quando
   * não havia foto — com foto, os dois faziam a mesma coisa. A área maior da
   * tela servia a ação secundária, e a câmera ficava sem gesto próprio.
   */
  it('o quadro tira foto e o lápis escolhe da galeria', () => {
    expect(codigo).toMatch(/onPress=\{takePhoto\}\s+style=\{\[styles\.quadro/);
    expect(codigo).toMatch(/onPress=\{choosePhoto\}\s+style=\{styles\.lapis/);
  });

  /**
   * O defeito relatado duas vezes pelo dono do produto, e visto num print em
   * 09/08: o lápis aparecia cortado ao meio.
   *
   * `bottom: -18` transborda o container, e no React Native quem é desenhado
   * depois pinta por cima — o card da legenda cobria metade do botão, e a
   * metade coberta não recebia toque.
   */
  it('o lápis vence o card da legenda na ordem de pintura', () => {
    // A folga tira o encosto visual...
    expect(codigo).toMatch(/midia:\s*\{\s*paddingBottom:\s*40/);
    // ...e o zIndex é o que devolve o toque.
    expect(codigo).toMatch(/midia:\s*\{[^}]*zIndex:\s*2/);
    expect(codigo).toMatch(/trio:\s*\{[^}]*zIndex:\s*2/);
    expect(codigo).toMatch(/cartao:\s*\{[^}]*zIndex:\s*1/);
  });

  it('publicar mora no cabeçalho, e não num bloco fixo no rodapé', () => {
    const cabecalho = codigo.indexOf('styles.header');
    const acao = codigo.indexOf('onPress={publish}');
    const rolagem = codigo.indexOf('<ScrollView');

    // Antes do ScrollView = dentro do cabeçalho. No rodapé ele era coberto pelo
    // teclado da legenda.
    expect(acao).toBeGreaterThan(cabecalho);
    expect(acao).toBeLessThan(rolagem);
  });

  it('responde às duas perguntas de antes de publicar', () => {
    // Para onde vai, e se conta. Nenhuma das duas tinha resposta na tela.
    expect(codigo).toContain("t('rooms.postingTo')");
    expect(codigo).toMatch(/countsForChallenge|doesNotCount/);
  });

  it('não promete controle sobre a hora, que é do servidor', () => {
    const trecho = codigo.slice(codigo.indexOf("t('rooms.checkInTime')"));
    // Um campo editável aqui prometeria algo que o cliente não decide — ele
    // nunca manda tempo.
    expect(trecho.slice(0, 200)).not.toContain('TextInput');
  });

  it('a foto não se perde quando publicar falha', () => {
    const captura = codigo.slice(codigo.indexOf('const publish'));
    // `setPhoto(null)` no catch já custou o post de alguém.
    expect(captura.slice(0, 600)).not.toContain('setPhoto(null)');
    expect(captura).toContain('setError');
  });

  it('mantém a saída do teclado na legenda', () => {
    // A legenda é multiline: Enter quebra linha e não fecha. Sem a barra, o iOS
    // não oferece saída nenhuma.
    expect(codigo).toContain('InputAccessoryView');
    expect(codigo).toContain('Keyboard.dismiss');
  });
});
