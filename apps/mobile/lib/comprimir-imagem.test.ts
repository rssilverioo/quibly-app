import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Toda foto que sai do aparelho passa pelo compressor.
 *
 * Em 14/08 o dono do produto reparou que as fotos demoravam. A causa era que
 * **nada** redimensionava: o app capturava em resolução cheia, a API guardava
 * como veio, e o feed baixava o arquivo inteiro para desenhar num quadrado
 * pequeno. Um avatar no CDN pesava 807 KB para aparecer com 40 pixels de lado.
 *
 * O conserto é fácil de fazer e fácil de esquecer: basta alguém escrever uma
 * quinta tela que sobe imagem e não chamar `comprimirImagem`. O defeito volta,
 * calado, só naquele caminho — e ninguém percebe, porque as outras telas
 * continuam rápidas.
 *
 * Por isso este teste é de código-fonte: ele não conhece as quatro telas de
 * hoje, conhece a **regra**. Quem escolher uma imagem tem que comprimi-la.
 */

const RAIZ = join(__dirname, '..');

function arquivosTsx(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome);
      return statSync(caminho).isDirectory()
        ? arquivosTsx(caminho)
        : caminho.endsWith('.tsx')
          ? [caminho]
          : [];
    });
  } catch {
    return [];
  }
}

describe('compressão de imagem', () => {
  it('toda tela que escolhe imagem também comprime', () => {
    const escolhem = [...arquivosTsx(join(RAIZ, 'app')), ...arquivosTsx(join(RAIZ, 'components'))]
      .map((caminho) => ({ caminho, fonte: readFileSync(caminho, 'utf8') }))
      .filter(({ fonte }) =>
        /launchCameraAsync|launchImageLibraryAsync/.test(fonte),
      );

    // Se este número cair a zero, o filtro quebrou e o teste virou decoração.
    expect(escolhem.length).toBeGreaterThan(0);

    const semCompressao = escolhem
      .filter(({ fonte }) => !fonte.includes('comprimirImagem'))
      .map(({ caminho }) => caminho.replace(RAIZ + '/', ''));

    expect(
      semCompressao,
      'estas telas sobem a foto no tamanho original — ver lib/comprimir-imagem.ts',
    ).toEqual([]);
  });

  it('o compressor sempre grava JPEG', () => {
    /*
     Foto de caderno não tem transparência a preservar, e um PNG da mesma foto
     pesa várias vezes mais. O avatar de 807 KB era exatamente isso: um PNG.
    */
    const fonte = readFileSync(join(RAIZ, 'lib/comprimir-imagem.ts'), 'utf8');
    expect(fonte).toContain('SaveFormat.JPEG');
    expect(fonte).not.toContain('SaveFormat.PNG');
  });

  it('falhar em comprimir não impede publicar', () => {
    // Comprimir é otimização. Se o manipulador falhar, a pessoa ainda tem que
    // conseguir postar o que estudou — com a foto grande, que é melhor que nada.
    const fonte = readFileSync(join(RAIZ, 'lib/comprimir-imagem.ts'), 'utf8');
    expect(fonte).toMatch(/catch\s*\{\s*return uri;/);
  });
});
