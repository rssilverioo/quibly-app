import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const abaEstudar = readFileSync(
  new URL('../app/(tabs)/study.tsx', import.meta.url).pathname,
  'utf8',
);

/**
 * Relatado pelo dono do produto em 04/08, depois de usar o app: *"se eu saio
 * dele, ele não continua rolando, ele pausou"*.
 *
 * Continuava rolando. Sair de `session/active` não para nada desde a Fase 1 —
 * quem conta o tempo é o servidor, via heartbeat com janela de 5 minutos. O que
 * não existia era **qualquer sinal na tela** de que a sessão seguia viva: este
 * card era `{isPaused && …}`, ou seja, aparecia se você tinha pausado e sumia
 * se estava rodando. Rodando e parado ficavam visualmente idênticos, e a
 * conclusão de quem usa é a única disponível: pausou sozinho.
 */
describe('uma sessão viva aparece fora da própria tela', () => {
  it('no longer hides a running session behind the paused flag', () => {
    // A regressão a evitar tem forma exata: voltar a depender só de `isPaused`
    // faz a sessão rodando sumir do app inteiro de novo.
    expect(abaEstudar).not.toContain('{isPaused && (');
    expect(abaEstudar).toContain('temSessaoViva');
    expect(abaEstudar).toContain('isRunning || isPaused');
  });

  it('names the running state instead of reusing the paused copy', () => {
    expect(abaEstudar).toContain("tr('sessionRunning')");
    expect(abaEstudar).toContain("tr('sessionPaused')");
  });

  it('keeps the clock ticking, because a frozen one reads as stopped', () => {
    // `displayedElapsedSeconds()` é derivado no render: sem um render por
    // segundo o número congela, e um "estudando agora" congelado diz
    // exatamente o contrário do que quer dizer.
    expect(abaEstudar).toContain('setInterval');
    expect(abaEstudar).toContain('displayedElapsedSeconds()');
  });
});
