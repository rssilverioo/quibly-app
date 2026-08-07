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

const INTERVALO_MS = 3000;

/**
 * Busca as mensagens agora e a cada 3s. Devolve como cancelar.
 *
 * `onErro` não é opcional por capricho. A versão anterior engolia **toda** falha
 * — inclusive a da primeira busca —, e como quem chama só desligava o
 * "carregando" dentro do callback de sucesso, uma API fora do ar deixava o chat
 * num spinner eterno, sem uma linha no console. Era indistinguível de "a sala
 * está demorando", e foi assim que o chat passou por quebrado.
 *
 * A falha do *polling* é diferente da falha da primeira busca: já há mensagem na
 * tela, e uma rede que oscila não deve apagá-la. Por isso o erro é reportado,
 * mas a lista anterior fica de pé — quem chama decide o que fazer com o aviso.
 */
export function subscribeToMessages(
  leagueId: string,
  onMensagens: (messages: ChatMessageComAutor[]) => void,
  onErro: (erro: unknown) => void,
): () => void {
  let vivo = true;

  const buscar = async () => {
    try {
      const mensagens = await getMessages(leagueId);
      if (vivo) onMensagens(mensagens);
    } catch (erro) {
      if (vivo) onErro(erro);
    }
  };

  void buscar();
  const intervalo = setInterval(() => void buscar(), INTERVALO_MS);

  return () => {
    vivo = false;
    clearInterval(intervalo);
  };
}
