import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const caminho = (p: string) => new URL(p, import.meta.url).pathname;

/**
 * Sem comentários, para as asserções abaixo não casarem com a prosa que
 * *explica* o defeito em vez de com o código que o evita. Já aconteceu.
 */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const splash = ler('../components/CitySplash.tsx');
const login = ler('../app/(auth)/login.tsx');
const abertura = ler('./abertura.ts');
const layout = ler('../app/_layout.tsx');

const CIDADES = ['los-angeles', 'new-york', 'san-francisco'];

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

  it('as três fotografias existem', () => {
    for (const cidade of CIDADES) {
      expect(existsSync(caminho(`../assets/splash-cities/${cidade}.jpg`))).toBe(true);
      expect(abertura).toContain(`splash-cities/${cidade}.jpg`);
    }
  });

  /**
   * O splash nativo e este se sucedem em milissegundos. Cores diferentes
   * aparecem como um piscar — e o nativo vive em três lugares fora do JS.
   */
  it('usa o mesmo azul do splash nativo', () => {
    expect(abertura).toContain('#015FFD');

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
    for (const tela of [splash, login]) {
      expect(tela).toContain('resizeMode="cover"');
    }
    expect(splash).toContain('absoluteFillObject');
  });
});

/**
 * O splash e o login mostram a **mesma** fotografia, no **mesmo** ponto do
 * zoom. São dois componentes: um desmonta e o outro monta. Qualquer decisão
 * tomada dentro de um deles diverge da do outro no quadro exato da troca — é
 * daí que sairia uma cidade trocando ou a câmera saltando para trás.
 */
describe('a costura entre o splash e o login', () => {
  it('a cidade é sorteada num lugar só, fora das duas telas', () => {
    expect(abertura).toMatch(/export const cidadeDaAbertura/);

    // Nenhuma das telas sorteia por conta própria.
    for (const tela of [semComentarios(splash), semComentarios(login)]) {
      expect(tela).not.toContain('Math.random');
      expect(tela).toContain('cidadeDaAbertura');
    }
  });

  /**
   * O zoom é função do tempo decorrido desde que o bundle subiu, e não estado
   * da tela: quem monta depois entra no meio da curva em vez de recomeçar.
   */
  it('as duas telas continuam a mesma aproximação', () => {
    expect(abertura).toContain('export const INICIO_DA_ABERTURA');

    for (const tela of [splash, login]) {
      // Começa onde o relógio estiver…
      expect(tela).toContain('useSharedValue(escalaDaAproximacao())');
      // …e anima só o que falta, sem aceleração que faria a velocidade saltar.
      expect(tela).toContain('restanteDaAproximacaoMs()');
      expect(tela).toContain('Easing.linear');
    }
  });
});

/**
 * A tela de login virou a própria fotografia. O cenário desenhado que existia
 * antes — céu noturno, nuvens, fórmulas fantasma — foi feito para uma tela sem
 * imagem, e sobre a foto viraria um segundo cenário na frente do primeiro.
 */
describe('o login sobre a fotografia', () => {
  it('não repõe o cenário desenhado por cima da foto', () => {
    for (const sinal of ['NIGHT_GRADIENT', 'GhostSymbol', 'DriftingCloud', 'Particle']) {
      expect(semComentarios(login)).not.toContain(sinal);
    }
  });

  /**
   * `c.fg` é a cor de texto da *superfície do tema*. Aqui não há superfície de
   * tema: com o app claro, o vidro viraria branco e o texto sobre ele, preto
   * sobre a foto. O palco é a marca, e a marca não muda com o tema (§5.15).
   */
  it('o vidro é escuro mesmo com o app claro', () => {
    expect(login).toContain('scheme="dark"');
    expect(ler('../components/ui/Glass.tsx')).toContain('scheme?: ThemeMode');
  });

  /**
   * O botão da Apple é uma view do sistema e o do Google segue medidas e cores
   * prescritas. Envidraçar qualquer um dos dois reprova na revisão — o vidro é
   * o painel em volta.
   */
  it('não envidraça os botões de entrada', () => {
    const apple = ler('../components/auth/AppleSignInButton.tsx');
    const google = ler('../components/auth/GoogleSignInButton.tsx');
    expect(apple).not.toContain('Glass');
    expect(google).not.toContain('Glass');
    expect(google).toContain('#131314');
  });
});
