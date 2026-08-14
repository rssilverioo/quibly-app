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

  it('quando o id for real, o manifest precisa carregá-lo', () => {
    /*
     Enquanto for o de teste, o manifest pode estar vazio — o app não serve
     anúncio no Android de qualquer forma. Quando alguém puser o id de verdade,
     este teste cobra a outra metade, que é a que o build lê.
    */
    if (androidAppId.includes(TESTE)) return;

    expect(
      manifest,
      'o androidAppId saiu do modo de teste, mas o AndroidManifest.xml não tem\n' +
        'com.google.android.gms.ads.APPLICATION_ID — o SDK falha calado e a\n' +
        'faixa nunca aparece. Ver o cabeçalho deste arquivo.',
    ).toContain('com.google.android.gms.ads.APPLICATION_ID');
    expect(manifest).toContain(androidAppId);
  });

  it('o manifest não pode carregar um id diferente do declarado', () => {
    const noManifest = /android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s+android:value="([^"]+)"/.exec(
      manifest,
    )?.[1];
    if (!noManifest) return;
    expect(noManifest).toBe(androidAppId);
  });
});
