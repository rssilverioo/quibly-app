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
  it('asks for the deadline, and no longer for a mode', () => {
    expect(criarSala).toContain("t('rooms.duration')");
    // O modo caiu em 04/08/2026: não existe sala de foto e sala de timer.
    // Toda sala tem as duas portas, e quem liga o timer aparece na sala.
    expect(criarSala).not.toContain("t('rooms.challengeMode')");
    expect(criarSala).not.toContain("participation_mode");
  });

  it('sends the deadline, so the room is not born inert', () => {
    // Só o prefixo: o último argumento é `prazoEmDias`, que resolve a régua e o
    // calendário num número só. Travar o nome dele aqui quebraria o teste a
    // cada refatoração sem proteger nada.
    expect(criarSala).toContain('createRoom(name.trim(), displayName.trim(),');
    expect(servicoSalas).toContain('duration_days');
  });

  it('leaves the timer available in every room, with no mode to gate it', () => {
    const sala = ler('../app/league/room/[id].tsx');
    expect(sala).not.toContain('isStudyChallenge');
    expect(sala).toContain("t('rooms.startTimer')");
  });
});
