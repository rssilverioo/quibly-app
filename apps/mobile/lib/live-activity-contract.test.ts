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
  /**
   * `LiveActivityIntent` **roda no processo do app**, não no da extensão.
   *
   * A primeira versão do intent vivia só em `targets/widget/`, e o botão chamava
   * um tipo que o app não conhecia: o dedo tocava e nada acontecia. Como o
   * `perform()` falha em silêncio, não havia log, erro nem sintoma.
   *
   * A extensão precisa do tipo para **declarar** o botão; o app precisa dele
   * para **executar**. As duas cópias têm que ser iguais, como as de
   * `StudyTimerAttributes`.
   */
  it('o App Intent existe no app e na extensão, idênticos', () => {
    expect(ler('../modules/study-timer/ios/SessionActionIntent.swift')).toBe(
      ler('../targets/widget/SessionActionIntent.swift'),
    );
  });

  /**
   * `application-groups` **não estava em nenhum dos dois perfis de
   * provisionamento** do build 44 — declarar a entitlement no config não faz a
   * Apple registrar o grupo. `UserDefaults(suiteName:)` devolvia `nil` e o
   * intent morria na primeira linha.
   *
   * Como o `LiveActivityIntent` roda no processo do app, o `UserDefaults`
   * padrão basta e não depende de provisionamento nenhum.
   */
  it('o intent não depende do App Group para funcionar', () => {
    expect(ler('../targets/widget/SessionActionIntent.swift')).toContain('?? .standard');
    expect(ler('../modules/study-timer/ios/StudyTimerModule.swift')).toContain(
      'UserDefaults.standard, UserDefaults(suiteName',
    );
  });

  it('cada caminho de falha do intent se identifica no log', () => {
    // Quatro causas indistinguíveis num processo sem tela foi o que impediu o
    // diagnóstico da primeira vez.
    const intent = ler('../targets/widget/SessionActionIntent.swift');
    expect((intent.match(/NSLog/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

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

  /**
   * O app conta para baixo dentro do bloco; a Ilha contava para cima na sessão
   * inteira. Dois números diferentes lado a lado, sem pista de qual valia.
   */
  it('conta para baixo quando há bloco, como a tela do app', () => {
    expect(codigo).toContain('countsDown: true');
    expect(codigo).toContain('phaseStartedAt...state.phaseEndsAt');
  });

  it('a barra é do sistema, não calculada por nós', () => {
    // Uma barra que nós calculássemos ficaria congelada na fração do último
    // heartbeat — 30 segundos de atraso, com o app suspenso.
    expect(codigo).toContain('ProgressView(timerInterval:');
  });

  /**
   * A extensão de widget não carrega i18n — não tem o i18next nem os JSON de
   * tradução. Texto fixo no Swift aparece em português para quem usa o app em
   * inglês, que foi o que aconteceu no build 44.
   */
  it('não tem texto de interface fixo em português', () => {
    for (const palavra of ['"Pausar"', '"Retomar"', '"Encerrar"', '"Estudando"']) {
      expect(codigo).not.toContain(palavra);
    }
  });

  /**
   * O card é **mostrador**, não controle — decisão do dono do produto em 09/08.
   *
   * Os dois botões disputavam espaço com a única informação que se olha de
   * relance, e com o foco profundo a saída da sessão passou a ser uma decisão
   * que merece a tela do app: lá ela custa dez segundos, aqui custaria um toque
   * cego na tela bloqueada.
   *
   * O teste existe porque "botão de novo na Live Activity" é o tipo de coisa
   * que volta sem querer, num merge ou numa cópia de exemplo.
   */
  it('não tem controle nenhum — só mostrador', () => {
    expect(codigo).not.toContain('Button(intent:');
    expect(codigo).not.toContain('Link(destination:');
    expect(codigo).not.toContain('quibly://session/');
  });

  it('usa o accent azul do app, e não o lime aposentado em 31/07', () => {
    // O cronômetro na tela de bloqueio era a última superfície do produto ainda
    // em verde-limão.
    expect(codigo).not.toContain('quiblyLime');
    expect(codigo).toContain('quiblyAccent');
  });
});

/**
 * Os botões do widget disparavam `quibly://session/pause` e o app mostrava
 * **"Unmatched Route"** — visto num print de aparelho. Os controles da tela de
 * bloqueio nunca funcionaram no iOS.
 *
 * Este é o caminho de quem está em iOS 16, onde `Button(intent:)` não existe em
 * Live Activity.
 */
describe('o deep link da Live Activity tem que cair em algum lugar', () => {
  const layout = ler('../app/_layout.tsx');
  const widget = ler('../targets/widget/StudyTimerLiveActivity.swift');

  /**
   * O widget deixou de disparar estas ações — ver "só mostrador", acima. O
   * tratamento no app **fica**: os mesmos deep links chegam de notificação e da
   * Ilha Dinâmica de builds antigas ainda instaladas, e um link que ninguém
   * trata abre o app numa tela em branco.
   */
  it('o app continua entendendo os deep links de sessão', () => {
    expect(widget).not.toContain('quibly://session/');
    expect(layout).toContain("path?.startsWith('session/')");
  });

  it('aplica no mesmo store dos controles em tela', () => {
    // Um segundo caminho para pausar seria um segundo jeito de as duas
    // superfícies discordarem.
    expect(layout).toContain('useSessionStore.getState()');
    expect(layout).toMatch(/store\.pause\(\)/);
    expect(layout).toMatch(/store\.resume\(\)/);
    expect(layout).toMatch(/store\.endSession\(\)/);
  });

  it('não age quando não há sessão viva', () => {
    // O widget pode sobreviver ao fim da sessão; agir ali recriaria estado que
    // o servidor já encerrou.
    expect(layout).toContain('if (!store.currentSession) return;');
  });
});

/**
 * Swift aceita comentário de bloco **aninhado**.
 *
 * Um `/` seguido de `*` dentro de um comentário — escrevendo uma rota como
 * `quibly://session/` com curinga, por exemplo — abre um bloco novo que nunca
 * fecha e engole o resto do arquivo. O compilador então reclama de símbolos
 * "não encontrados" que estão logo ali, e o erro real fica a dezenas de linhas
 * de distância.
 *
 * Custou um build inteiro da EAS. O teste é uma contagem, e paga por si.
 */
describe('os comentários do Swift não podem engolir o arquivo', () => {
  const arquivos = [
    '../targets/widget/StudyTimerLiveActivity.swift',
    '../targets/widget/SessionActionIntent.swift',
    '../targets/widget/StudyTimerAttributes.swift',
    '../targets/widget/CoelhoMark.swift',
    '../modules/study-timer/ios/StudyTimerModule.swift',
    '../modules/study-timer/ios/StudyTimerAttributes.swift',
  ];

  it.each(arquivos)('%s tem blocos de comentário balanceados', (caminho) => {
    const fonte = ler(caminho);
    const abre = (fonte.match(/\/\*/g) ?? []).length;
    const fecha = (fonte.match(/\*\//g) ?? []).length;

    expect({ arquivo: caminho, abre, fecha }).toEqual({ arquivo: caminho, abre, fecha: abre });
  });
});

/**
 * Todo símbolo que a extensão usa tem que estar definido **nela**.
 *
 * O Swift dos alvos não passa pelo `tsc` nem pelo vitest: nada no repositório o
 * compila. Um símbolo apagado só aparece no build da EAS, dez minutos e uma fila
 * depois — foi assim que o build 52 morreu com `type 'Color' has no member
 * 'quiblyAccent'`, porque a extensão da cor morava logo abaixo dos botões que
 * eu removi e o corte pegou o vizinho.
 *
 * Este teste não substitui um compilador. Cobre o caso que de fato acontece:
 * apagar um trecho e levar junto algo que outro trecho usava.
 */
describe('a extensão define o que ela mesma usa', () => {
  const arquivos = ['../targets/widget/StudyTimerLiveActivity.swift', '../targets/widget/CoelhoMark.swift']
    .map((caminho) => ler(caminho))
    .join('\n');

  it('define toda cor `Color.quibly*` que referencia', () => {
    const usadas = new Set(
      [...arquivos.matchAll(/Color\.(quibly[A-Za-z]+)/g)].map((m) => m[1]),
    );
    expect(usadas.size).toBeGreaterThan(0);
    for (const cor of usadas) {
      expect(arquivos, `Color.${cor} é usada mas não é definida no alvo`).toMatch(
        new RegExp(`static let ${cor}\\b`),
      );
    }
  });
});
