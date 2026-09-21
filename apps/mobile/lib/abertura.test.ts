import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const caminho = (p: string) => new URL(p, import.meta.url).pathname;

const abertura = ler('./abertura.ts');
const tela = ler('../components/Abertura.tsx');
const login = ler('../app/(auth)/login.tsx');
const layout = ler('../app/_layout.tsx');

/**
 * A abertura é clara desde 21/09/2026: o primeiro quadro já é o app.
 *
 * Antes eram três estilos em três segundos — coelho chapado sobre azul,
 * fotografia de cidade americana com o coelho colado, e então o app claro.
 * Este teste guarda o que faz a passagem ser invisível: uma cor só, em
 * quatro lugares, e o mesmo coelho no nativo e no JS.
 */
describe('a abertura', () => {
  it('substitui o vazio enquanto a autenticação resolve', () => {
    expect(layout).toContain('if (isLoading) return <Abertura />');
    expect(layout).not.toContain('if (isLoading) return null');
  });

  /**
   * O splash nativo e o JS se sucedem em milissegundos. Cores diferentes
   * aparecem como um piscar — e o nativo vive em três lugares fora do JS.
   */
  it('usa a mesma cor clara do splash nativo, nos quatro lugares', () => {
    expect(abertura).toContain("COR_DA_ABERTURA = '#F7F7F9'");
    expect(JSON.parse(ler('../app.json')).expo.splash.backgroundColor).toBe('#F7F7F9');

    const iosCor = JSON.parse(
      ler('../ios/Quibly/Images.xcassets/SplashScreenBackground.colorset/Contents.json'),
    ).colors[0].color.components;
    const paraHex = (v: string) => Math.round(parseFloat(v) * 255);
    expect([paraHex(iosCor.red), paraHex(iosCor.green), paraHex(iosCor.blue)])
      .toEqual([0xf7, 0xf7, 0xf9]);

    expect(ler('../android/app/src/main/res/values/colors.xml'))
      .toContain('<color name="splashscreen_background">#F7F7F9</color>');
  });

  /** É o `bg` do tema claro, copiado: se o tema mudar, a abertura acompanha. */
  it('a cor é o bg do tema claro', () => {
    expect(ler('../theme/colors.ts')).toContain("bg: '#F7F7F9'");
  });

  /**
   * O nativo mostra o PNG quadrado em `contain`, ajustado à largura e centrado.
   * O JS desenha o mesmo PNG com a largura da tela e centrado: mesma posição,
   * pixel a pixel. Qualquer outra medida faria o coelho pular na troca.
   */
  it('mostra o mesmo coelho do splash nativo, no mesmo lugar', () => {
    expect(abertura).toContain("require('../assets/splash.png')");
    expect(JSON.parse(ler('../app.json')).expo.splash.image).toBe('./assets/splash.png');
    expect(tela).toContain('style={{ width, height: width }}');
    expect(tela).toContain('resizeMode="contain"');
    expect(existsSync(caminho('../assets/splash.png'))).toBe(true);
  });

  it('as fotografias de cidade foram embora com o conceito', () => {
    expect(existsSync(caminho('../assets/splash-cities'))).toBe(false);
    for (const fonte of [abertura, tela, login]) {
      expect(fonte).not.toContain('splash-cities');
      expect(fonte).not.toContain('Glass');
    }
  });
});

/**
 * O login é feito do material do app: fundo claro, superfície branca, o
 * coelho no traço dos coelhos do onboarding. E a cor do fundo é a da abertura,
 * literal, para a passagem não piscar.
 */
describe('o login', () => {
  it('continua na cor da abertura', () => {
    expect(login).toContain('backgroundColor: COR_DA_ABERTURA');
  });

  it('usa o coelho do onboarding, não uma foto', () => {
    expect(login).toContain('COELHOS.celular_quibly');
  });

  /**
   * O botão da Apple é uma view do sistema e o do Google segue medidas e cores
   * prescritas — na variante **clara**, porque o painel em volta é branco. As
   * variantes escuras (Apple WHITE, Google #131314) serviam ao vidro e aqui
   * sumiriam ou destoariam.
   */
  it('os botões de entrada estão na variante clara dos guias', () => {
    const apple = ler('../components/auth/AppleSignInButton.tsx');
    const google = ler('../components/auth/GoogleSignInButton.tsx');
    expect(apple).toContain('AppleAuthenticationButtonStyle.BLACK');
    expect(google).toContain("surface: '#FFFFFF'");
    expect(google).toContain("border: '#747775'");
    expect(google).not.toContain('#131314');
  });
});
