import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autorDaMensagem, mensagensDaResposta } from './chat-messages';

const mensagem = (extra: any = {}) => ({
  id: 'm1',
  league_id: 'sala',
  user_id: 'u1',
  content: 'oi',
  message_type: 'text' as const,
  created_at: '2026-08-07T10:00:00.000Z',
  ...extra,
});

/**
 * O chat ficava num spinner eterno, e a causa era esta: o cliente pedia
 * `api.get<ChatMessage[]>` e a API devolve `{ messages, hasMore }`. O genérico
 * do TypeScript é uma afirmação, não uma verificação — ninguém conferia. A tela
 * então fazia `[...resposta]` sobre um objeto, o que lança, e o `catch` vazio
 * engolia. `setLoading(false)` vivia só no caminho de sucesso.
 */
describe('mensagensDaResposta', () => {
  it('tira as mensagens de dentro do envelope', () => {
    const lista = mensagensDaResposta({ messages: [mensagem()], has_more: false });

    expect(lista).toHaveLength(1);
    expect(lista[0].content).toBe('oi');
  });

  it('aceita um array cru, se o servidor um dia parar de envelopar', () => {
    expect(mensagensDaResposta([mensagem()])).toHaveLength(1);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['objeto sem a chave', { has_more: true }],
    ['messages que não é lista', { messages: 'nada' }],
    ['string', 'erro'],
  ])('devolve lista vazia para %s, em vez de lançar', (_caso, entrada) => {
    // Lançar aqui derrubava a tela inteira; vazio é recuperável e o aviso de
    // falha é dado por quem chama.
    expect(() => mensagensDaResposta(entrada)).not.toThrow();
    expect(mensagensDaResposta(entrada)).toEqual([]);
  });
});

/**
 * O segundo desalinhamento do mesmo endpoint: o `include` do Prisma nomeia a
 * junção `user`, e a tela lia `profile`. O nome saía vazio em toda bolha.
 */
describe('autorDaMensagem', () => {
  it('lê o autor de `user`, que é o que a API manda', () => {
    const { nome, avatar } = autorDaMensagem(
      mensagem({ user: { username: 'rodrigo', avatar_url: 'https://x/a.png' } }),
    );

    expect(nome).toBe('rodrigo');
    expect(avatar).toBe('https://x/a.png');
  });

  it('ainda aceita `profile`, que é o que o tipo compartilhado declara', () => {
    const { nome } = autorDaMensagem(mensagem({ profile: { username: 'ana' } }));

    expect(nome).toBe('ana');
  });

  it('não quebra quando não veio autor nenhum', () => {
    // Mensagem de sistema não tem autor, e a bolha só esconde o nome se ele for
    // string vazia — `undefined` viraria "undefined" na tela.
    expect(autorDaMensagem(mensagem())).toEqual({ nome: '', avatar: null });
  });
});

const servico = readFileSync(new URL('../services/chat.ts', import.meta.url).pathname, 'utf8');
const tela = readFileSync(
  new URL('../app/league/chat/[id].tsx', import.meta.url).pathname,
  'utf8',
);

describe('chat — a falha não pode ficar invisível', () => {
  it('o serviço reporta erro em vez de engolir', () => {
    // A forma que causou o defeito: `catch {}` sem nada dentro.
    expect(servico).not.toMatch(/catch\s*\{\s*\}/);
    expect(servico).toContain('onErro');
  });

  it('a tela desliga o "carregando" também no caminho de erro', () => {
    const trecho = tela.slice(tela.indexOf('subscribeToMessages('), tela.indexOf('return () => unsubscribe()'));
    // Duas vezes: uma no sucesso, uma no erro. Só no sucesso era o defeito.
    expect(trecho.match(/setLoading\(false\)/g)).toHaveLength(2);
  });

  it('não reordena o que a API já entrega na ordem certa', () => {
    // Sem os comentários: eles explicam o `.reverse()` que foi removido, e uma
    // busca crua acusaria a própria explicação.
    const codigo = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // `inverted` desenha o índice 0 embaixo, e a API manda `createdAt desc`.
    expect(codigo).not.toContain('.reverse()');
    expect(codigo).toContain('setMessages(all)');
  });

  it('avisa na tela, em vez de fingir sala vazia', () => {
    expect(tela).toContain("t('rooms.chatOffline')");
  });
});
