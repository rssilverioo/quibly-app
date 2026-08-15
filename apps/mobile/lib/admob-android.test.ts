import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O AdMob no Android — que hoje **não existe**, e este teste registra por quê.
 *
 * ## O que se descobriu em 14/08
 *
 * O `app.json` declara o plugin `react-native-google-mobile-ads` com
 * `androidAppId`, e o `AndroidManifest.xml` não tem **uma linha** de AdMob.
 * Zero referências a `com.google.android.gms.ads`.
 *
 * A causa é a mesma que já mordeu o iOS: `android/` está versionado, então o
 * EAS não roda `prebuild`, e o plugin nunca escreveu no manifest. No iOS o
 * valor estava lá porém desatualizado; aqui está simplesmente ausente.
 *
 * A consequência é silenciosa, que é o que a torna cara: sem
 * `com.google.android.gms.ads.APPLICATION_ID` no manifest, o SDK falha ao
 * inicializar, o `try/catch` de `ligarAnuncios()` engole, e a faixa nunca
 * aparece. Ninguém vê erro; só não há anúncio, e portanto não há receita.
 *
 * ## Por que o teste aceita o estado atual
 *
 * Porque o conserto depende de um identificador que ainda não existe: o app
 * Android precisa ser criado no painel do AdMob, e isso é trabalho de conta, não
 * de código. Fazer o teste falhar agora seria deixar a suíte vermelha por uma
 * pendência externa — ruído que ensina a ignorar teste quebrado.
 *
 * O que ele garante é a **coerência**: no dia em que o `androidAppId` deixar de
 * ser o identificador de teste do Google, o manifest tem que ganhar a entrada
 * correspondente. Sem isso, alguém preencheria o `app.json`, veria o commit
 * bonito, e o binário continuaria sem anúncio.
 */

const raiz = join(__dirname, '..');
const ler = (caminho: string) => readFileSync(join(raiz, caminho), 'utf8');

/** O publisher público de teste do Google. */
const TESTE = '3940256099942544';

describe('AdMob no Android', () => {
  const appJson = ler('app.json');
  const manifest = ler('android/app/src/main/AndroidManifest.xml');
  const androidAppId = /"androidAppId":\s*"([^"]+)"/.exec(appJson)?.[1] ?? '';

  it('o plugin declara um androidAppId', () => {
    expect(androidAppId).toMatch(/^ca-app-pub-/);
  });

  /**
   * O id chega ao manifest pela **biblioteca**, não por nós.
   *
   * `react-native-google-mobile-ads` já declara
   * `com.google.android.gms.ads.APPLICATION_ID` no manifest dela, com o
   * placeholder `${appJSONGoogleMobileAdsAppID}`, que o Gradle preenche lendo a
   * chave `react-native-google-mobile-ads` do **topo** do `app.json` — fora de
   * `expo`, que é onde o plugin do Expo vive.
   *
   * Em 14/08 eu adicionei a entrada à mão no nosso manifest e o build quebrou:
   * duas declarações da mesma `meta-data` fazem o merger do Gradle falhar, e o
   * erro chega ao EAS como "unknown gradle error", sem dizer o que houve.
   *
   * Por isso o teste agora exige o **contrário** do que exigia: a chave no
   * `app.json` precisa existir, e o nosso manifest precisa ficar **sem** a
   * entrada. A do Expo (`plugins`) continua servindo o iOS.
   */
  it('a chave que o Gradle lê existe, no topo do app.json', () => {
    const raiz = JSON.parse(appJson)['react-native-google-mobile-ads'];
    expect(raiz?.android_app_id).toBe(androidAppId);
    expect(raiz?.android_app_id).not.toContain(TESTE);
  });

  it('o nosso manifest não declara o APPLICATION_ID — a biblioteca declara', () => {
    expect(
      manifest,
      'duas declarações da mesma meta-data quebram o merger do Gradle, e o EAS\n' +
        'só reporta "unknown gradle error". Ver o cabeçalho deste arquivo.',
    ).not.toContain('com.google.android.gms.ads.APPLICATION_ID');
  });
});

/**
 * O par biblioteca ⇄ SDK ⇄ Kotlin, que precisa andar junto.
 *
 * ## O que se descobriu em 14/08, depois de cinco builds falhados
 *
 * `react-native-google-mobile-ads` fixa a versão do `play-services-ads` no
 * `package.json` dela, sem ponto de configuração. E o Google passou a compilar
 * esse SDK com Kotlin mais novo que o do Expo SDK 54, que traz **2.1.20**:
 *
 *   | play-services-ads | metadata Kotlin |
 *   |-------------------|-----------------|
 *   | até 24.8.0        | 2.1.0           |
 *   | 24.9.0 – 25.3.0   | 2.2.0           |
 *   | 25.4.0            | 2.3.0           |
 *
 * (Números lidos do cabeçalho dos `.kotlin_module` dentro de cada `.aar`, não
 * estimados.) Acima do teto o compilador recusa a dependência inteira:
 *
 *   e: Module was compiled with an incompatible version of Kotlin.
 *      The binary version of its metadata is 2.3.0, expected version is 2.1.0.
 *
 * ## Por que a saída não é prender o SDK
 *
 * Foi a primeira coisa tentada — `resolutionStrategy.force` em 24.8.0 — e o
 * build quebrou **pior**, porque a lib 16.4.0 chama uma API que só existe na
 * 25.4.0:
 *
 *   e: Unresolved reference 'AgeRestrictedTreatment'
 *
 * Os dois lados são amarrados. Descer só o SDK tira o chão da biblioteca.
 *
 * ## O arranjo atual
 *
 * Em vez de recuar a biblioteca até onde o Kotlin antigo alcança, subimos o
 * Kotlin: `android.kotlinVersion=2.2.20` no `gradle.properties`, que é o teto
 * suportado pelo Expo (a tabela `KSPLookup` do plugin termina aí, e não existe
 * KSP publicado para 2.3.x no formato que ele espera). Com 2.2.20 o teto de
 * metadata passa a ser **2.2.0**, e a lib pode ser a 16.3.4 — uma versão menor
 * abaixo da atual, em vez das dezesseis que o recuo custaria.
 *
 * ## O que este teste protege
 *
 * Um `npm update` distraído sobe a lib, o SDK vem junto, e o build morre com
 * "unknown gradle error" — sem uma palavra sobre Kotlin. Foram cinco builds
 * para descobrir isso da primeira vez. Aqui custa um teste vermelho.
 *
 * Os dois números andam juntos: se um dia o Expo suportar Kotlin 2.3, sobem o
 * `android.kotlinVersion` e o `TETO` na mesma mudança, e aí a 16.4.0 volta.
 */

/** A maior `play-services-ads` com metadata Kotlin 2.2, que é o que 2.2.20 lê. */
const TETO = [25, 3, 0];


describe('AdMob: a biblioteca e o Kotlin do projeto', () => {
  it('a versão fixada do play-services-ads compila com o nosso Kotlin', () => {
    const lib = JSON.parse(
      readFileSync(join(raiz, 'node_modules/react-native-google-mobile-ads/package.json'), 'utf8'),
    );
    const fixada: string = lib.sdkVersions.android.googleMobileAds;
    const partes = fixada.split('.').map(Number);

    /** Compara versão por posição: negativo se `fixada` vem antes do teto. */
    const ordem = TETO.reduce<number>((jaDecidido, limite, i) => {
      if (jaDecidido !== 0) return jaDecidido;
      return (partes[i] ?? 0) - limite;
    }, 0);

    expect(
      ordem <= 0,
      `react-native-google-mobile-ads ${lib.version} fixa play-services-ads ${fixada},\n` +
        `acima do teto ${TETO.join('.')} que o Kotlin 2.2.20 do projeto consegue ler.\n` +
        'O build vai falhar em :react-native-google-mobile-ads:compileReleaseKotlin,\n' +
        'e o EAS só vai dizer "unknown gradle error". Ver o cabeçalho deste bloco.',
    ).toBe(true);
  });

  /**
   * O teto acima só vale enquanto o Kotlin do projeto for o que dizemos.
   *
   * `TETO = 25.3.0` é uma afirmação sobre o compilador: 2.2.20 lê metadata
   * 2.2.0. Se alguém remover a linha do `gradle.properties`, o Expo volta a
   * 2.1.20 sozinho, o teto vira mentira, e o teste acima passa enquanto o build
   * quebra — o pior tipo de teste. Por isso os dois são conferidos juntos.
   */
  it('o Kotlin declarado é o que sustenta o teto', () => {
    expect(
      ler('android/gradle.properties'),
      'sem `android.kotlinVersion` o Expo usa 2.1.20, que só lê metadata 2.1 —\n' +
        `e aí o teto ${TETO.join('.')} deste arquivo passa a mentir.`,
    ).toContain('android.kotlinVersion=2.2.20');
  });
});
