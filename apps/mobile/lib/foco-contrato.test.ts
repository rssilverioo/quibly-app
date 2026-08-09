import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

/** Compilado dentro do **app**, pelo autolinking do módulo Expo. */
const noApp = '../modules/foco-profundo/ios/EstadoDoFoco.swift';
/** Compilado dentro da extensão que derruba o escudo pelo relógio do sistema. */
const noMonitor = '../targets/foco-monitor/EstadoDoFoco.swift';
/** Compilado dentro da extensão que desenha a tela do bloqueio. */
const noEscudo = '../targets/foco-escudo/EstadoDoFoco.swift';

/**
 * `EstadoDoFoco` é compilado **três vezes** — no app e nas duas extensões — e os
 * três processos se coordenam por dois literais: o nome da loja de ajustes e o
 * nome do App Group.
 *
 * O modo de falhar é o pior que existe para este recurso. Se as cópias
 * divergirem, **nada quebra na compilação**: os três targets compilam, o app
 * levanta uma loja chamada `A`, o monitor derruba uma chamada `B`, e os apps da
 * pessoa ficam bloqueados **para sempre** — até ela descobrir sozinha que a
 * saída é o Tempo de Uso nos Ajustes, ou apagar o Quibly.
 *
 * É exatamente o desastre que o recurso inteiro foi desenhado para não permitir
 * (ver as quatro garantias em `FocoProfundoModule.swift`), e uma divergência de
 * um caractere desliga três delas de uma vez: `liberar()` no monitor, a
 * reconciliação do app e o teto de segurança dependem todos de os três lados
 * concordarem sobre qual loja é a nossa.
 *
 * Se este teste falhar: copie do módulo para os alvos, nunca o contrário. O
 * módulo é a fonte — é ele que o app usa para levantar o escudo.
 */
describe('o estado do foco é o mesmo nos três processos', () => {
  it('mantém as três cópias de EstadoDoFoco byte a byte iguais', () => {
    expect(ler(noMonitor)).toBe(ler(noApp));
    expect(ler(noEscudo)).toBe(ler(noApp));
  });

  it('ainda declara os dois literais de que a coordenação depende', () => {
    // Salvaguarda contra o teste acima virar tautologia: três arquivos vazios
    // também são idênticos, e também estão errados.
    const contrato = ler(noApp);
    expect(contrato).toContain('ManagedSettingsStore.Name("com.quibly.foco")');
    expect(contrato).toContain('group.com.quibly.app');
  });

  it('mantém o teto de segurança, que é a última rede', () => {
    // Se alguém subir isto para 24h "porque alguém queria estudar o dia todo",
    // o custo do pior caso deixa de ser uma tarde e passa a ser um dia inteiro
    // de telefone bloqueado.
    expect(ler(noApp)).toContain('static let tetoDeSeguranca: TimeInterval = 4 * 60 * 60');
  });

  it('grava a validade antes de o escudo subir, e não depois', () => {
    // A ordem é a diferença entre "limite sem escudo" (inofensivo) e "escudo
    // sem limite" (o estado do qual não se sai).
    const modulo = ler('../modules/foco-profundo/ios/FocoProfundoModule.swift');
    const marca = modulo.indexOf('EstadoDoFoco.marcarInicio');
    const escudo = modulo.indexOf('store.shield.applicationCategories');
    expect(marca).toBeGreaterThan(-1);
    expect(escudo).toBeGreaterThan(marca);
  });
});

/**
 * A classe principal de cada extensão é nomeada **no `Info.plist`**, e é por
 * esse nome que o sistema a instancia.
 *
 * Se o Swift declarar outro nome, nada quebra: a extensão é compilada,
 * assinada, embarcada e carregada — e nunca instanciada. Para o foco profundo
 * isso apaga a garantia (2) inteira, e apaga em silêncio; a única evidência
 * seria o escudo continuar de pé depois de o app ser encerrado, que é
 * exatamente o desastre que este recurso existe para não permitir.
 *
 * Os `Info.plist` são gerados pelo `@bacons/apple-targets`, que escolhe os
 * nomes — então quem tem que ceder é o nosso Swift, e uma regeneração pode
 * mudar o plist sem avisar. Daí o teste, e não um comentário.
 */
describe('cada extensão declara a classe que o Info.plist manda instanciar', () => {
  const casos = [
    { plist: '../targets/foco-monitor/Info.plist', swift: '../targets/foco-monitor/FocoMonitor.swift' },
    { plist: '../targets/foco-escudo/Info.plist', swift: '../targets/foco-escudo/FocoEscudo.swift' },
  ];

  for (const { plist, swift } of casos) {
    it(`casa ${plist.split('/')[2]} com o Swift dele`, () => {
      const pedida = ler(plist).match(
        /<key>NSExtensionPrincipalClass<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.([A-Za-z0-9_]+)<\/string>/,
      );
      expect(pedida, 'o Info.plist precisa nomear a classe principal').not.toBeNull();
      expect(ler(swift)).toContain(`class ${pedida![1]}:`);
    });
  }
});
