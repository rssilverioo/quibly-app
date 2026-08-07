import { api } from '../lib/api';
import type { ChatMessage } from '@quibly/shared';
import { mensagensDaResposta, type ChatMessageComAutor } from '../lib/chat-messages';

export async function sendMessage(
  leagueId: string,
  _userId: string,
  content: string
): Promise<ChatMessage> {
  return api.post<ChatMessage>(`/chat/${leagueId}`, { content });
}

/**
 * As mensagens da sala, da mais nova para a mais velha.
 *
 * O tipo do `api.get` é `unknown` de propósito: era exatamente aqui que um
 * `api.get<ChatMessage[]>` afirmava um array que a API nunca mandou (ela devolve
 * `{ messages, hasMore }`), e o compilador não tinha como discordar. Quem
 * conhece o formato é `mensagensDaResposta`, que é testado.
 */
export async function getMessages(
  leagueId: string,
  limitCount = 50
): Promise<ChatMessageComAutor[]> {
  return mensagensDaResposta(
    await api.get<unknown>(`/chat/${leagueId}?limit=${limitCount}`),
  );
}
