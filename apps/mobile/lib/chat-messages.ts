import type { ChatMessage } from '@quibly/shared';

/**
 * O que o `GET /chat/:leagueId` devolve de verdade.
 *
 * Duas coisas aqui divergiam do que o app supunha, e as duas em silêncio.
 *
 * **A resposta é um envelope, não um array.** `chat.service` devolve
 * `{ messages, hasMore }` — o cliente pedia `api.get<ChatMessage[]>` e o
 * genérico do TypeScript é só uma afirmação: ninguém conferia, então o
 * compilador via um array onde chegava um objeto.
 *
 * **O autor vem em `user`, não em `profile`.** O `include` do Prisma nomeia a
 * junção `user`, e o `SnakeCaseInterceptor` a entrega como `user`. A tela lia
 * `profile.username`, que nunca existiu na resposta.
 */
export interface AutorDaMensagem {
  username?: string;
  handle?: string;
  avatar_url?: string | null;
  /** O selo, quando há. Ver `components/ui/SeloVerificado`. */
  verification?: 'BLUE' | 'GOLD' | null;
}

export interface ChatMessageComAutor extends ChatMessage {
  user?: AutorDaMensagem;
  /**
   * Quando o autor apagou. O servidor manda a marca e **não manda o texto** —
   * é o cliente que desenha a lápide. Ausente nas mensagens vivas.
   */
  deleted_at?: string | null;
}

export interface RespostaDeMensagens {
  messages?: ChatMessageComAutor[];
  has_more?: boolean;
}

/**
 * As mensagens de dentro do envelope, **da mais nova para a mais velha**.
 *
 * A ordem é a que a `FlatList inverted` quer: com `inverted`, o índice 0 é
 * desenhado embaixo, que é onde a mensagem mais nova tem que aparecer. É também
 * a ordem em que a API já entrega (`orderBy: createdAt desc`) — a tela fazia um
 * `.reverse()` a mais, escrito quando se supunha que a resposta vinha crescente.
 * Como a chamada estourava antes disso, o engano nunca chegou a desenhar.
 *
 * Resposta fora do formato vira lista vazia em vez de exceção: o chat mostra
 * "sem mensagens", que é recuperável, em vez de derrubar a tela.
 */
export function mensagensDaResposta(resposta: unknown): ChatMessageComAutor[] {
  if (Array.isArray(resposta)) return resposta;
  const lista = (resposta as RespostaDeMensagens | null)?.messages;
  return Array.isArray(lista) ? lista : [];
}

/**
 * Nome e avatar de quem escreveu, com as duas formas aceitas.
 *
 * `user` é o que a API manda hoje. `profile` fica aceito porque é o que o tipo
 * compartilhado declara, e um dia o servidor pode passar a honrá-lo — ler os
 * dois custa uma linha e evita que a troca quebre a tela de novo.
 */
export function autorDaMensagem(mensagem: ChatMessageComAutor): {
  nome: string;
  avatar: string | null;
  selo: 'BLUE' | 'GOLD' | null;
} {
  return {
    nome: mensagem.user?.username ?? mensagem.profile?.username ?? '',
    avatar: mensagem.user?.avatar_url ?? mensagem.profile?.avatar_url ?? null,
    // `null` na esmagadora maioria. Ler as duas formas pela mesma razão do
    // nome e do avatar, logo acima.
    selo: mensagem.user?.verification ?? mensagem.profile?.verification ?? null,
  };
}
