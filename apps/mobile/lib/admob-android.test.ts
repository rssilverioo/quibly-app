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
