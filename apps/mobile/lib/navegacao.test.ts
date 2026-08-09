import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;

/**
 * `router.back()` supõe que existe uma tela anterior. Quando não existe, o
 * Expo Router registra "The action 'GO_BACK' was not handled by any navigator"
 * e o toque **não faz nada** — o botão de fechar não fecha.
 *
 * Em desenvolvimento vira uma faixa vermelha; em produção o aviso some e o
 * defeito fica, mudo. E a pilha vazia não é caso de laboratório: acontece em
 * todo deep link — o convite, a notificação de mensagem, os botões da Live
 * Activity. Justamente nos caminhos em que a pessoa acabou de abrir o app.
 */
describe('voltar', () => {
  it('nenhuma tela chama router.back() direto', () => {
    const saida = execSync(
      `grep -rln "router\\.back()" ${raiz}app ${raiz}components || true`,
      { encoding: 'utf8' },
    ).trim();

    expect(saida).toBe('');
  });

  it('o helper cai num destino quando não há para onde voltar', () => {
    const fonte = readFileSync(`${raiz}lib/navegacao.ts`, 'utf8');
    expect(fonte).toContain('router.canGoBack()');
    // `replace` e não `push`: a tela que sai não pode ficar na pilha esperando
    // um "voltar" que devolveria ao beco sem saída.
    expect(fonte).toContain('router.replace(destino)');
  });
});
