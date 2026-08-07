import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) =>
  readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

/** Compilado dentro do **app**, pelo autolinking do módulo Expo. */
const noApp = '../modules/study-timer/ios/StudyTimerAttributes.swift';
/** Compilado dentro da **extensão**, pelo `@bacons/apple-targets`. */
const noWidget = '../targets/widget/StudyTimerAttributes.swift';

/**
 * `StudyTimerAttributes` é compilado duas vezes — uma no app, outra no widget —
 * e o ActivityKit casa os dois lados pelo **nome do tipo**, não pelo módulo.
 *
 * Na prática funciona, e é o arranjo que a maioria dos projetos usa. O que ele
 * tem de perigoso é o modo de falhar: se as duas cópias divergirem em um campo,
 * **não há erro de compilação**. Os dois targets compilam, o app pede a
 * atividade, e o sistema a recusa em silêncio — o widget simplesmente não
 * aparece. É indistinguível de "Live Activity não implementada", que é
 * exatamente o estado do qual estamos saindo.
 *
 * O plugin caseiro evitava isso copiando o arquivo a cada `prebuild`. Com o
 * `@bacons/apple-targets` a pasta do target é versionada, então a cópia é real
 * e pode divergir. Este teste troca a falha silenciosa por uma vermelha.
 *
 * Se ele falhar: copie o arquivo do módulo para `targets/widget/`, não o
 * contrário — o módulo é a fonte, porque é ele que o app usa para abrir e
 * atualizar a atividade.
 */
describe('o contrato da Live Activity é o mesmo dos dois lados', () => {
  it('keeps the app and widget copies of StudyTimerAttributes byte-identical', () => {
    expect(ler(noWidget)).toBe(ler(noApp));
  });

  it('still declares the fields the widget renders', () => {
    // Uma salvaguarda contra o teste acima virar tautologia: se alguém apagar o
    // conteúdo dos dois arquivos, eles continuam idênticos e continuam errados.
    const contrato = ler(noApp);
    expect(contrato).toContain('struct StudyTimerAttributes');
    expect(contrato).toContain('ContentState');
  });

  /**
   * A UI também está duplicada, e essa cópia é pior que a do contrato.
   *
   * `modules/study-timer/widget/` **não é compilado**: o `source_files` do
   * podspec varre recursivamente a partir de `ios/`, então a pasta irmã fica de
   * fora. É resto do plugin caseiro que o `@bacons/apple-targets` substituiu.
   *
   * O perigo não é o arquivo morto — é ele parecer vivo. Quem abrir o módulo
   * para ajustar o widget edita o arquivo errado, compila, instala, e não vê
   * mudança nenhuma. Enquanto as duas cópias existirem, elas têm que ser iguais,
   * para que o engano custe no máximo um `git diff`.
   */
  it('mantém a cópia morta do widget idêntica à que compila', () => {
    expect(ler('../modules/study-timer/widget/StudyTimerLiveActivity.swift')).toBe(
      ler('../targets/widget/StudyTimerLiveActivity.swift'),
    );
  });
});

/**
 * O defeito visto num 17 Pro Max: a Ilha compacta esticava numa faixa preta com
 * um vão enorme entre o mascote e o contador.
 *
 * `Text(timerInterval:)` reserva a largura do **maior valor do intervalo**, e o
 * intervalo terminava em `Date.distantFuture` — largura de uma duração
 * astronômica. É comportamento conhecido e sem correção da Apple
 * (developer.apple.com/forums/thread/723316), então o teto tem que vir de nós.
 */
describe('a Dynamic Island compacta não pode reservar largura infinita', () => {
  const widget = ler('../targets/widget/StudyTimerLiveActivity.swift');
  /**
   * Sem comentários: eles explicam o `distantFuture` e o `quiblyLime` que foram
   * removidos, e uma busca crua acusaria a própria explicação. O que está sob
   * teste é o código.
   */
  const codigo = widget.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('não ancora o contador em distantFuture', () => {
    expect(codigo).not.toContain('Date.distantFuture');
  });

  it('fecha o intervalo numa janela finita', () => {
    expect(codigo).toContain('JANELA_DO_CONTADOR');
  });

  it('usa o accent azul do app, e não o lime aposentado em 31/07', () => {
    // O cronômetro na tela de bloqueio era a última superfície do produto ainda
    // em verde-limão.
    expect(codigo).not.toContain('quiblyLime');
    expect(codigo).toContain('quiblyAccent');
  });
});
