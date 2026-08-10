import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O índice das ilustrações contra a pasta que ele indexa.
 *
 * `assets/coelhos/index.ts` precisa ter um `require` **literal** por arquivo —
 * o Metro resolve caminhos em tempo de build, e `require(variável)` não existe
 * no bundle. Isso significa que o índice é escrito à mão e a pasta é a verdade;
 * as duas divergem no primeiro coelho que alguém adicionar.
 *
 * O modo de falha é silencioso dos dois lados, e é por isso que vale um teste:
 * um arquivo sem entrada é peso morto no bundle que ninguém vê; uma entrada sem
 * arquivo derruba a tela — e só em tempo de execução, na tela específica que
 * usa aquela pose, que pode ser um estado vazio que ninguém abre em teste.
 */

const raiz = join(__dirname, '..');
const PASTA = join(raiz, 'assets/coelhos');

const naPasta = readdirSync(PASTA)
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.replace(/^coelho-/, '').replace(/\.png$/, '').replace(/-/g, '_'))
  .sort();

const indice = readFileSync(join(PASTA, 'index.ts'), 'utf8');
const noIndice = [...indice.matchAll(/^\s{2}(\w+):\s*require\(/gm)]
  .map((m) => m[1])
  .sort();

describe('as ilustrações do coelho', () => {
  it('o índice cobre todos os arquivos da pasta', () => {
    expect(noIndice).toEqual(naPasta);
  });

  it('cada nome do índice aponta para um arquivo que existe', () => {
    const arquivos = new Set(readdirSync(PASTA));
    for (const nome of noIndice) {
      expect(arquivos.has(`coelho-${nome.replace(/_/g, '-')}.png`)).toBe(true);
    }
  });

  it('o mapa de estados só usa nomes que o índice conhece', () => {
    const mapa = readFileSync(join(raiz, 'components/mascot/ilustracoes.ts'), 'utf8');
    const usados = [...mapa.matchAll(/COELHOS\.(\w+)/g)].map((m) => m[1]);
    expect(usados.length).toBeGreaterThan(0);
    for (const nome of usados) expect(noIndice).toContain(nome);
  });

  it('nenhum estado do mascote é mapeado duas vezes para poses diferentes', () => {
    const mapa = readFileSync(join(raiz, 'components/mascot/ilustracoes.ts'), 'utf8');
    const pares = [...mapa.matchAll(/^\s{2}(\w+):\s*COELHOS\.(\w+),/gm)];
    const estados = pares.map((p) => p[1]);
    expect(new Set(estados).size).toBe(estados.length);
  });
});
