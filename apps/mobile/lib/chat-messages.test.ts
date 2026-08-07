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

/** O código da tela, sem comentários — eles citam as formas já removidas. */
const codigoDaTela = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('chat — a falha não pode ficar invisível', () => {
  it('o serviço não engole erro', () => {
    // A forma que causou o defeito: `catch {}` sem nada dentro.
    expect(servico).not.toMatch(/catch\s*\{\s*\}/);
  });

  it('a busca desliga o "carregando" em qualquer saída', () => {
    // `finally` e não duas chamadas: o defeito original era o `setLoading` viver
    // só no caminho de sucesso, e um `finally` torna isso impossível de repetir.
    expect(codigoDaTela).toMatch(/finally\s*\{\s*setLoading\(false\)/);
  });

  it('não reordena o que a API já entrega na ordem certa', () => {
    // `inverted` desenha o índice 0 embaixo, e a API manda `createdAt desc`.
    // Quem garante a ordem agora é `reconciliar`, que é testado à parte.
    expect(codigoDaTela).not.toContain('.reverse()');
    expect(codigoDaTela).toContain('reconciliar(');
  });

  it('avisa na tela, em vez de fingir sala vazia', () => {
    expect(tela).toContain("t('rooms.chatOffline')");
  });
});

describe('chat — tempo real', () => {
  it('a bolha aparece antes da ida ao servidor', () => {
    const envio = codigoDaTela.slice(codigoDaTela.indexOf('const onSend'));
    const otimista = envio.indexOf('bolhaOtimista');
    const entrega = envio.indexOf('entregar(');

    // A ordem é o ponto: montar a bolha depois da entrega devolveria o chat ao
    // comportamento de esperar a rede para mostrar o próprio texto.
    expect(otimista).toBeGreaterThan(-1);
    expect(otimista).toBeLessThan(entrega);
  });

  it('a sala é reconectada, e o polling só existe como rede de segurança', () => {
    expect(codigoDaTela).toContain('conectarAoChat(');
    // A busca periódica sai de cena quando o socket está de pé.
    expect(codigoDaTela).toMatch(/if\s*\(conectado\)\s*return;/);
  });

  it('para de anunciar digitação ao enviar', () => {
    const envio = codigoDaTela.slice(codigoDaTela.indexOf('const onSend'));
    // Sem isto o "está digitando" fica na tela dos outros depois da mensagem
    // já ter chegado — o aviso desmentido pela própria bolha.
    expect(envio).toContain('digitando(false)');
  });
});
