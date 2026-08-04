import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) =>
  readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

const criarSala = ler('../app/league/create.tsx');
const servicoSalas = ler('../services/rooms.ts');

/**
 * Relatado pelo dono do produto em 04/08, depois de usar o app: criar sala e
 * depois criar um desafio dentro dela "não faz todo sentido".
 *
 * Não fazia mesmo. A sala nascia com uma janela de desafio morta
 * (`1970-01-01`), então `activeChallenge` era `null`, e como
 * `isStudyChallenge(null)` é falso ela nascia **sem botão de timer e sem faixa
 * de "estudando agora"**. Tudo o que nos separa do GymRats ficava atrás de um
 * segundo passo que nenhuma tela pedia — quem criasse a primeira sala recebia
 * um GymRats pior, sem a parte que é nossa.
 *
 * O irmão deste caso está em `session-visibility.test.ts`, e a raiz é a mesma:
 * estado vivo que não aparece na tela.
 */
describe('a sala nasce funcionando', () => {
  it('asks for mode and duration when the room is created', () => {
    expect(criarSala).toContain("t('rooms.challengeMode')");
    expect(criarSala).toContain("t('rooms.duration')");
    // Os mesmos dois modos de `challenge/new.tsx`, pelas mesmas chaves.
    expect(criarSala).toContain("t('rooms.photoMode')");
    expect(criarSala).toContain("t('rooms.studyMode')");
  });

  it('sends both to the server instead of letting the room be born inert', () => {
    // Só o prefixo: o quarto argumento passou a ser `prazoEmDias`, que resolve
    // a régua e o calendário num número só. Travar o nome dele aqui quebraria o
    // teste a cada refatoração sem proteger nada.
    expect(criarSala).toContain('createRoom(name.trim(), displayName.trim(), mode,');
    expect(servicoSalas).toContain('participation_mode');
    expect(servicoSalas).toContain('duration_days');
  });

  it('defaults to photo, which is the GymRats the reference describes', () => {
    expect(criarSala).toContain("useState<'photo' | 'study'>('photo')");
  });
});
