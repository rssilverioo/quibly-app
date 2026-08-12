import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Os modos de segundo plano declarados — e o que a Apple faz com eles.
 *
 * Em 12/08 a revisão reprovou o build 65 pela **Guideline 2.5.4**: o
 * `Info.plist` declarava `UIBackgroundModes: [audio]` e o revisor não achou
 * nenhum recurso que precisasse de áudio persistente. Ele estava certo — o
 * único uso de áudio no app é a gravação de aula, em `app/lesson/capture.tsx`,
 * que chama `setAudioModeAsync` **sem** `staysActiveInBackground`. A gravação
 * nunca continuou em segundo plano; o modo estava declarado e ocioso.
 *
 * Declarar um modo que não se usa não é detalhe burocrático: `audio` mantém o
 * processo vivo indefinidamente, e é o truque clássico para segurar um
 * cronômetro rodando. A Apple procura exatamente isso, e reprova.
 *
 * Este teste vale por dois arquivos porque o valor mora em dois: `app.json` é a
 * fonte, `ios/Quibly/Info.plist` é o que o build lê. Como `ios/` está
 * versionado (por causa das extensões), o EAS **não roda `prebuild`** — mexer
 * só no `app.json` não mudaria o binário. É o mesmo par que já derrubou o
 * identificador do AdMob.
 *
 * Se um dia existir um recurso que de fato precise de áudio em segundo plano,
 * a linha volta — junto com uma gravação de tela na nota ao revisor, que é o
 * que a Apple pede nesse caso.
 */

const raiz = join(__dirname, '..');
const ler = (caminho: string) => readFileSync(join(raiz, caminho), 'utf8');

describe('UIBackgroundModes', () => {
  it('não é declarado no app.json', () => {
    expect(ler('app.json')).not.toContain('UIBackgroundModes');
  });

  it('não é declarado no Info.plist, que é o que vai no binário', () => {
    expect(ler('ios/Quibly/Info.plist')).not.toContain('UIBackgroundModes');
  });

  it('nada no app pede áudio em segundo plano', () => {
    /*
     A guarda que importa de verdade: se alguém ligar
     `staysActiveInBackground`, o modo passa a ser necessário — e aí o teste
     acima vira mentira, porque o recurso existiria sem a declaração que o
     sustenta. Melhor quebrar aqui do que descobrir no aparelho de alguém.
    */
    const captura = ler('app/lesson/capture.tsx');
    expect(captura).not.toContain('staysActiveInBackground');
  });
});
