import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * Este teste roda o Babel de verdade, no mesmo modo do build de produção, em
 * vez de conferir o texto do arquivo.
 *
 * É a única forma honesta de cobrir o defeito de 04/08: `lib/firebase.ts`
 * checava as variáveis com `process.env[nome]`, e `babel-preset-expo` só
 * substitui `process.env.X` quando a chave é um literal. O acesso computado
 * saía do build intacto e, num bundle de release, `process.env` não tem
 * nenhuma `EXPO_PUBLIC_*` — então a tela "Configuração ausente" bloqueava o
 * app acusando seis variáveis que estavam inlinadas no próprio bundle.
 *
 * Nenhuma leitura do código-fonte pega isso: os dois acessos são igualmente
 * válidos em TypeScript e se comportam igual em desenvolvimento. A diferença
 * só aparece depois da transformação, que é o que se afirma aqui.
 */
const require_ = createRequire(import.meta.url);
const babel = require_('@babel/core');

const REQUIRED = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

/** Valores reconhecíveis: o que importa é se sobrevivem à transformação. */
function transformarComoNoBuild(filename: string, omitir: string[] = []) {
  const anterior = { ...process.env };

  for (const nome of REQUIRED) {
    if (omitir.includes(nome)) delete process.env[nome];
    else process.env[nome] = `valor-de-${nome}`;
  }

  try {
    return (
      babel.transformFileSync(filename, {
        presets: [require_.resolve('babel-preset-expo')],
        // `isDev: false` é o que liga o inlining; em desenvolvimento o preset
        // troca a leitura por um import de `expo/virtual/env`, e aí o valor
        // ainda existe em runtime. O bug só existe no build.
        caller: { name: 'metro', isDev: false, platform: 'ios', supportsStaticESM: true },
        babelrc: false,
        configFile: false,
      })?.code ?? ''
    );
  } finally {
    process.env = anterior;
  }
}

describe('firebase config in a production bundle', () => {
  const saida = transformarComoNoBuild(new URL('./firebase.ts', import.meta.url).pathname);

  it.each(REQUIRED)('inlines %s instead of leaving a runtime lookup', (nome) => {
    expect(saida).toContain(`valor-de-${nome}`);
  });

  it('never reaches process.env through a computed key', () => {
    // O acesso computado é exatamente o que o preset não enxerga. Se ele
    // reaparecer aqui — por uma lista de nomes, um `for...of`, um helper
    // `ler(nome)` — a checagem volta a acusar tudo como ausente no build.
    expect(saida).not.toMatch(/process\.env\[/);
  });

  it('still has something to catch when a variable is genuinely absent', () => {
    // O guarda não pode virar decoração. Sem a variável no builder, o preset
    // inlina `undefined` — valor falso, que `missing` recolhe e a tela nomeia.
    // Este é o caso que a tela foi feita para pegar, e o único em que ela deve
    // aparecer.
    const semChave = transformarComoNoBuild(
      new URL('./firebase.ts', import.meta.url).pathname,
      ['EXPO_PUBLIC_FIREBASE_API_KEY'],
    );

    expect(semChave).toContain('EXPO_PUBLIC_FIREBASE_API_KEY:undefined');
    expect(semChave).not.toContain('valor-de-EXPO_PUBLIC_FIREBASE_API_KEY');
    // As outras cinco continuam chegando: a falha é específica, não geral.
    expect(semChave).toContain('valor-de-EXPO_PUBLIC_FIREBASE_APP_ID');
  });
});
