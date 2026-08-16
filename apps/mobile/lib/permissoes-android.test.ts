import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * As permissões que o app **não** pede, e que só saem se alguém insistir.
 *
 * ## O que aconteceu em 16/08
 *
 * O primeiro envio para a Play foi recusado depois do upload:
 *
 *   Google Api Error: Invalid request - You must let us know whether your app
 *   uses any Foreground Service permissions.
 *
 * Lendo o manifest de dentro do `.aab` publicado, o único serviço em primeiro
 * plano era `androidx.work.impl.foreground.SystemForegroundService`, com
 * `foregroundServiceType="dataSync"` — do WorkManager, que vem de carona com o
 * Firebase Messaging e o `expo-notifications`. Nosso código não cria nenhum.
 *
 * No mesmo exame apareceu `RECORD_AUDIO`, declarado pelo `expo-camera` porque
 * ele sabe gravar vídeo. O app só tira foto: não há uma chamada a `recordAsync`
 * em lugar nenhum.
 *
 * ## Por que remover, e não declarar
 *
 * A declaração que a Play exige pede descrição e **vídeo demonstrando o uso**.
 * Não haveria o que filmar. Remover não é um atalho para escapar do formulário
 * — é a resposta verdadeira a ele.
 *
 * ## Por que isto é um teste, e não um comentário
 *
 * As três permissões chegam por **dependência transitiva**, de bibliotecas que
 * ninguém aqui edita. Uma atualização do `expo-camera` ou do WorkManager as
 * traz de volta sem nenhuma linha nossa mudar, e o preço é um envio recusado
 * depois de já ter subido 81 MB — que foi exatamente como descobrimos.
 */

const manifest = readFileSync(
  join(__dirname, '..', 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);

/** Cada uma com o motivo de não servir para nada aqui. */
const REMOVIDAS = [
  ['android.permission.FOREGROUND_SERVICE', 'não criamos serviço em primeiro plano'],
  ['android.permission.FOREGROUND_SERVICE_DATA_SYNC', 'idem — vem do WorkManager'],
  ['android.permission.RECORD_AUDIO', 'o check-in é foto; não gravamos vídeo'],
] as const;

describe('permissões que o Android não deve pedir', () => {
  it.each(REMOVIDAS)('%s sai do manifest final', (permissao, porque) => {
    /*
     A remoção é uma linha própria com `tools:node="remove"`, e não a ausência
     da permissão. Ausência não basta: quem declara são as bibliotecas, no
     merge — só uma instrução explícita desfaz isso.
    */
    const linha = new RegExp(
      `<uses-permission[^>]*android:name="${permissao.replace(/\./g, '\\.')}"[^>]*tools:node="remove"`,
    );

    expect(
      linha.test(manifest),
      `${permissao} precisa sair do manifest (${porque}).\n` +
        'Sem isso a Play recusa o envio depois do upload, pedindo a declaração\n' +
        'de Foreground Service. Ver o cabeçalho deste arquivo.',
    ).toBe(true);
  });

  /** Sem o xmlns:tools, os `tools:node` acima são texto decorativo. */
  it('o namespace tools está declarado', () => {
    expect(manifest).toContain('xmlns:tools="http://schemas.android.com/tools"');
  });
});
