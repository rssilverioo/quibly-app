import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const caminho = (p: string) => new URL(p, import.meta.url).pathname;

const splash = ler('../components/CitySplash.tsx');
const layout = ler('../app/_layout.tsx');

/**
 * A abertura ocupava o intervalo entre o splash nativo e o app com um
 * `return null` — uma tela vazia enquanto o Firebase resolvia a sessão, mais
 * longa em rede ruim, que é justamente quando ela mais aparece.
 */
describe('a tela de abertura', () => {
  it('substitui o vazio enquanto a autenticação resolve', () => {
    expect(layout).toContain('if (isLoading) return <CitySplash />');
    expect(layout).not.toContain('if (isLoading) return null');
  });

  it('as três ilustrações existem', () => {
    for (const cidade of ['sao-paulo', 'new-york', 'san-francisco']) {
      expect(existsSync(caminho(`../assets/splash-cities/${cidade}.jpg`))).toBe(true);
      expect(splash).toContain(`splash-cities/${cidade}.jpg`);
    }
  });

  /**
   * Sortear a cada render trocaria a ilustração no meio da abertura, toda vez
   * que a autenticação atualizasse o estado.
   */
  it('sorteia uma vez, na montagem', () => {
    expect(splash).toMatch(/useMemo\([\s\S]*Math\.random\(\)[\s\S]*\[\],\s*\)/);
  });

  /**
   * O splash nativo e este se sucedem em milissegundos. Cores diferentes
   * aparecem como um piscar — e o nativo vive em três lugares fora do JS.
   */
  it('usa o mesmo azul do splash nativo', () => {
    expect(splash).toContain('#015FFD');

    const iosCor = JSON.parse(
      ler('../ios/Quibly/Images.xcassets/SplashScreenBackground.colorset/Contents.json'),
    ).colors[0].color.components;
    const paraHex = (v: string) => Math.round(parseFloat(v) * 255);
    expect([paraHex(iosCor.red), paraHex(iosCor.green), paraHex(iosCor.blue)])
      .toEqual([0x01, 0x5F, 0xFD]);

    expect(ler('../android/app/src/main/res/values/colors.xml'))
      .toContain('<color name="splashscreen_background">#015FFD</color>');
  });

  it('cobre a tela inteira, sem barras', () => {
    // `contain` deixaria faixa azul em cima e embaixo numa arte que foi feita
    // para sangrar.
    expect(splash).toContain('resizeMode="cover"');
    expect(splash).toContain('absoluteFillObject');
  });
});
