import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');

const tela = ler('../app/league/post/[id].tsx');
const semana = ler('../components/checkin/SemanaDoCheckIn.tsx');
const codigo = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * A tela de check-in foi redesenhada em 09/08.
 *
 * A versão anterior punha a foto num quadro de 172pt ladeado por duas colunas
 * de rótulo. As perguntas que as colunas respondiam eram as certas — "para onde
 * vai" e "isto conta" — e a execução starvava o assunto: a foto, que é o
 * conteúdo inteiro de um check-in, aparecia menor que o texto que a explicava.
 *
 * Estes testes travam o que a nova tela decidiu, e mantêm os invariantes da
 * antiga que continuam valendo — eles foram escritos a partir de defeitos
 * reais, e um redesenho não os revoga.
 */
describe('check-in — a foto é a tela', () => {
  it('a foto ocupa o palco inteiro', () => {
    expect(codigo).toContain('styles.palco');
    expect(codigo).toMatch(/foto:\s*\{\s*\.\.\.StyleSheet\.absoluteFillObject/);
  });

  /**
   * `contain`, e não `cover`. Uma prova recortada é uma prova pela metade: se
   * alguém fotografou a mesa inteira, a mesa inteira é o que a sala vê.
   */
  it('não recorta a foto', () => {
    expect(codigo).toContain('resizeMode="contain"');
    expect(codigo).not.toContain('resizeMode="cover"');
  });

  /**
   * O defeito que o dono do produto relatou duas vezes: o lápis pendurava 18pt
   * abaixo do quadro, e o card da legenda — desenhado depois, portanto por
   * cima — cobria metade dele. O botão parecia estar lá e não recebia o toque.
   *
   * Agora os controles de trocar a foto vivem dentro do palco, ancorados no
   * topo, onde nada é desenhado depois deles.
   */
  it('os controles de trocar a foto não ficam sob outro bloco', () => {
    const trocar = codigo.indexOf('styles.trocar');
    const pe = codigo.indexOf('styles.pe');

    expect(trocar).toBeGreaterThan(-1);
    // Desenhado antes do pé: o que vem depois é que cobre.
    expect(trocar).toBeLessThan(pe);
    expect(codigo).toMatch(/trocar:\s*\{[^}]*top:/);
  });

  it('a câmera e a galeria têm cada uma o seu gesto', () => {
    // Antes os dois caminhos convergiam na galeria quando já havia foto, e a
    // câmera ficava sem gesto próprio.
    expect(codigo).toContain('onPress={tirarFoto}');
    expect(codigo).toContain('onPress={escolherFoto}');
  });
});

/**
 * As duas perguntas de antes de publicar continuam respondidas — por outros
 * meios. Este bloco existe para que remover as colunas não signifique perder
 * as respostas.
 */
describe('check-in — as duas perguntas', () => {
  it('mostra para onde vai', () => {
    expect(codigo).toContain('styles.etiquetaSala');
    expect(codigo).toContain('sala.name');
  });

  /**
   * "Isto conta" deixou de ser um selo e virou a semana: sete células com a de
   * hoje esperando. Publicar preenche. A resposta é a demonstração da
   * consequência, não um rótulo sobre ela.
   */
  it('mostra se marca o dia, pela semana', () => {
    expect(codigo).toContain('<SemanaDoCheckIn');
    expect(semana).toContain('celulaHoje');
    expect(semana).toContain("t('rooms.checkInMarksToday')");
    expect(semana).toContain("t('rooms.checkInFeedOnly')");
  });

  it('não afirma o que ainda não sabe', () => {
    // `marcaODia` é `null` enquanto a sala não carregou, e a faixa fica muda em
    // vez de chutar. Prometer "conta" e depois não contar é pior que esperar.
    expect(codigo).toContain('marcaODia = desafio');
    expect(semana).toContain("marcaODia === null");
  });
});

/** Invariantes herdados: cada um veio de um defeito real. */
describe('check-in — o que não pode voltar a quebrar', () => {
  it('a foto não se perde quando publicar falha', () => {
    const captura = codigo.slice(codigo.indexOf('const publicar'));
    // `setPhoto(null)` no catch já custou o post de alguém.
    expect(captura.slice(0, 700)).not.toContain('setPhoto(null)');
    expect(captura).toContain('setError');
  });

  it('mantém a saída do teclado na legenda', () => {
    // A legenda é multiline: Enter quebra linha e não fecha. Sem a barra, o iOS
    // não oferece saída nenhuma e a tela prende quem digitou.
    expect(codigo).toContain('InputAccessoryView');
    expect(codigo).toContain('Keyboard.dismiss');
  });

  it('não promete controle sobre a hora, que é do servidor', () => {
    // O cliente nunca manda tempo. Um campo editável aqui prometeria algo que
    // ele não decide.
    expect(codigo).not.toContain("t('rooms.checkInTime')");
  });
});
