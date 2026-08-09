import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sala = ler('../app/league/room/[id].tsx');
const chat = ler('../app/league/chat/[id].tsx');
const bloqueados = ler('../app/settings/bloqueados.tsx');
const ajustes = ler('../app/settings/index.tsx');

/**
 * O Guideline 1.2 da Apple exige denunciar **e** bloquear em qualquer app com
 * conteúdo de usuário, e exige que a pessoa consiga desfazer o bloqueio. O app
 * tem feed e chat: sem as três portas, é reprovação na revisão.
 *
 * A folha existia desde 08/08 e não estava ligada em lugar nenhum — o que é
 * pior que não existir, porque parece pronto no código e reprova mesmo assim.
 */
describe('as portas do Guideline 1.2', () => {
  it('o feed da sala abre a folha ao segurar um post', () => {
    expect(sala).toContain('<FolhaDeDenuncia');
    expect(sala).toContain('onLongPress=');
  });

  it('o chat abre a folha ao segurar uma mensagem', () => {
    expect(chat).toContain('<FolhaDeDenuncia');
    expect(chat).toContain('alvo="chat_message"');
  });

  it('existe a tela de gerenciar bloqueados, alcançável pelos ajustes', () => {
    expect(bloqueados).toContain('listarBloqueados');
    expect(bloqueados).toContain('desbloquear');
    expect(ajustes).toContain("router.push('/settings/bloqueados')");
  });

  /**
   * Oferecer "denunciar" sobre o próprio conteúdo é um menu que nunca leva a
   * nada — e sobre uma lápide de mensagem apagada, menos ainda.
   */
  it('não oferece denunciar o próprio conteúdo', () => {
    expect(semComentarios(sala)).toContain('item.user_id === user?.uid ? undefined');
    expect(semComentarios(chat)).toContain('mine || apagada ? undefined');
  });

  /**
   * Saber quem te bloqueou transforma proteção em confronto — a situação de
   * que a outra pessoa estava tentando sair.
   */
  it('não existe tela nem rota de "quem me bloqueou"', () => {
    const fonte = semComentarios(bloqueados) + semComentarios(ler('../services/moderation.ts'));
    expect(fonte).not.toMatch(/quemMeBloqueou|blockedBy|blocked-by/i);
  });
});
