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

describe('permissões declaradas', () => {
  /*
   Declarar permissão que não se usa é a mesma falha da 2.5.4, e a Apple é
   igualmente chata com isso. O microfone saiu em 12/08 junto com a captura de
   aula — sem ela, nada no app grava som.
  */
  it('o microfone não é mais pedido', () => {
    expect(ler('app.json')).not.toContain('NSMicrophoneUsageDescription');
    expect(ler('ios/Quibly/Info.plist')).not.toContain(
      'NSMicrophoneUsageDescription',
    );
  });
});

describe('UIBackgroundModes', () => {
  it('não é declarado no app.json', () => {
    expect(ler('app.json')).not.toContain('UIBackgroundModes');
  });

  it('não é declarado no Info.plist, que é o que vai no binário', () => {
    expect(ler('ios/Quibly/Info.plist')).not.toContain('UIBackgroundModes');
  });

  it('nada no app usa áudio', () => {
    /*
     A captura de aula era o único uso de áudio, e saiu em 12/08 junto com
     flashcards e quizzes. Se o áudio voltar, o modo de segundo plano volta a
     ser conversa — e é melhor quebrar aqui do que descobrir na revisão.
    */
    const fontes = ['app', 'components', 'services', 'lib', 'modules']
      .flatMap((dir) => arquivosDe(join(raiz, dir)))
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'));
    const comAudio = fontes.filter((f) =>
      /from '(expo-audio|expo-av)'/.test(readFileSync(f, 'utf8')),
    );
    expect(comAudio).toEqual([]);
  });
});

/** Lista recursiva, sem dependência externa. */
function arquivosDe(dir: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  try {
    return readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome);
      return statSync(caminho).isDirectory() ? arquivosDe(caminho) : [caminho];
    });
  } catch {
    return [];
  }
}
