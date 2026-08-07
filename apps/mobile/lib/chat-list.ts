import type { ChatMessageComAutor } from './chat-messages';

/**
 * A lista de mensagens como a tela a vê — **da mais nova para a mais velha**,
 * que é a ordem da `FlatList inverted`.
 *
 * Toda a costura mora aqui porque é onde o chat erra sem parecer errado: três
 * fontes escrevem na mesma lista — a busca inicial, o eco do socket e a bolha
 * otimista do próprio usuário — e o resultado de misturá-las mal é mensagem
 * duplicada ou fora de ordem, que só aparece com a sala em uso.
 */

export interface MensagemNaTela extends ChatMessageComAutor {
  /** Bolha otimista: existe só no aparelho até o servidor confirmar. */
  pendente?: boolean;
  /** Não chegou ao servidor. Fica na tela, apagada, com um ↻. */
  falhou?: boolean;
}

export const ehLocal = (id: string) => id.startsWith('local:');

/** Uma bolha que aparece antes da ida ao servidor. */
export function bolhaOtimista(
  conteudo: string,
  meuId: string,
  leagueId: string,
  agora = new Date(),
): MensagemNaTela {
  return {
    // O prefixo é o que distingue "ainda não tem id de verdade" de um uuid.
    id: `local:${agora.getTime()}:${Math.round(agora.getTime() % 1000)}`,
    league_id: leagueId,
    user_id: meuId,
    content: conteudo,
    message_type: 'text',
    created_at: agora.toISOString(),
    pendente: true,
  };
}

const maisNovaPrimeiro = (a: MensagemNaTela, b: MensagemNaTela) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

/**
 * Insere uma mensagem vinda do servidor.
 *
 * Duas proteções, e as duas existem por um caminho real:
 *
 * **Deduplicação por id** — o autor recebe a mesma mensagem duas vezes, pela
 * resposta do POST e pelo eco do socket, e não há ordem garantida entre as
 * duas.
 *
 * **Remoção da bolha otimista correspondente** — se o eco chega antes da
 * resposta do POST, a bolha local ainda está na tela e o texto apareceria em
 * dobro. Casa por autor e conteúdo, e só contra bolhas ainda pendentes; a mais
 * velha sai primeiro, que é a que foi enviada primeiro.
 */
export function inserir(
  lista: MensagemNaTela[],
  nova: MensagemNaTela,
  meuId?: string,
): MensagemNaTela[] {
  if (lista.some((m) => m.id === nova.id)) {
    // Já conhecida: atualiza no lugar em vez de duplicar (o eco pode trazer o
    // autor preenchido que a resposta do POST não tinha).
    return lista.map((m) => (m.id === nova.id ? { ...m, ...nova } : m));
  }

  const casa = (m: MensagemNaTela) =>
    Boolean(m.pendente) &&
    !m.falhou &&
    nova.user_id === meuId &&
    m.user_id === meuId &&
    m.content === nova.content;

  /**
   * A lista está da mais nova para a mais velha, então a bolha mais **velha** é
   * a última que casa — e é ela que sai. O servidor confirma na ordem em que
   * recebeu, então a primeira confirmação corresponde ao primeiro envio. Tirar
   * a mais nova deixaria duas bolhas trocadas de lugar: visualmente idênticas
   * hoje, e erradas no instante em que uma delas falhar.
   */
  let alvo = -1;
  for (let i = lista.length - 1; i >= 0; i--) {
    if (casa(lista[i])) { alvo = i; break; }
  }

  const semOtimista = alvo === -1 ? lista : lista.filter((_, i) => i !== alvo);

  return [...semOtimista, nova].sort(maisNovaPrimeiro);
}

/** Troca a bolha otimista pela mensagem que o servidor confirmou. */
export function confirmar(
  lista: MensagemNaTela[],
  localId: string,
  real: MensagemNaTela,
): MensagemNaTela[] {
  // Se o eco do socket já inseriu a real, a local só some — inseri-la de novo
  // duplicaria.
  if (lista.some((m) => m.id === real.id)) {
    return lista.filter((m) => m.id !== localId);
  }
  return lista
    .map((m) => (m.id === localId ? { ...real, pendente: false } : m))
    .sort(maisNovaPrimeiro);
}

/** Marca que a bolha não chegou. Ela fica na tela, para não perder o texto. */
export function marcarFalha(lista: MensagemNaTela[], localId: string): MensagemNaTela[] {
  return lista.map((m) =>
    m.id === localId ? { ...m, pendente: false, falhou: true } : m,
  );
}

/**
 * A lápide de uma mensagem apagada.
 *
 * O conteúdo é zerado aqui também, e não só no servidor: quem estava com a sala
 * aberta já tem o texto na memória, e sem isto ele continuaria na tela até
 * alguém reabrir a conversa — que é justamente quando apagar importa.
 */
export function marcarApagada(lista: MensagemNaTela[], id: string): MensagemNaTela[] {
  return lista.map((m) =>
    m.id === id ? { ...m, content: '', deleted_at: new Date().toISOString() } : m,
  );
}

/**
 * Junta a busca do servidor com o que já está na tela.
 *
 * A busca é a verdade sobre o que foi gravado, mas ela **não conhece as bolhas
 * pendentes** — elas ainda não existem no banco. Sobrescrever a lista com o
 * resultado cru faria a mensagem que a pessoa acabou de escrever sumir da tela
 * e voltar um segundo depois.
 */
export function reconciliar(
  doServidor: MensagemNaTela[],
  naTela: MensagemNaTela[],
): MensagemNaTela[] {
  const idsDoServidor = new Set(doServidor.map((m) => m.id));
  const locaisVivas = naTela.filter(
    (m) => ehLocal(m.id) && !idsDoServidor.has(m.id),
  );
  return [...doServidor, ...locaisVivas].sort(maisNovaPrimeiro);
}
