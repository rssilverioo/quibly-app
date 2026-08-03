import type { RoomFeedPost, RoomSummary } from '../services/rooms';

/**
 * Onde o post da sessão caiu, e por quê a tela pós-timer precisa procurar.
 *
 * `POST /sessions/:id/end` **não devolve o post criado** — devolve
 * `{ session, score, newAchievements, previous_level, new_level }` e mais nada
 * (`apps/api/src/sessions/sessions.controller.ts:59`). O fan-out acontece do
 * lado do servidor, dentro do mesmo `end`: `sessions.service.ts:649` cria um
 * `feedPost` por sala em que a pessoa é membro, e o id de cada um morre lá.
 *
 * `FLUXO §7` marca isso como dependência de contrato ("a resposta do `end`
 * precisa devolver o post criado — sem isso a tela nasce com um spinner
 * procurando no feed o post que acabou de criar"). Enquanto o contrato não
 * muda, é exatamente isso que este arquivo faz: pega os feeds das salas e
 * reconhece as cópias pelo `session.id`, que é o único fio que sobrou ligando
 * a sessão que acabou aos posts que ela criou.
 *
 * Fica em `lib/` e não em `services/` porque as funções aqui são puras — não
 * falam com a rede, não importam React Native — e é isso que permite testá-las
 * em `vitest` (`vitest.config.ts` só inclui `lib/**`).
 */
export interface PublishedCopy {
  roomId: string;
  roomName: string;
  /**
   * O desafio da sala a que este post foi atribuído, quando há um.
   *
   * **Hoje é sempre `null`, e isso é o contrato, não um bug.** O post do
   * servidor não carrega atribuição a desafio: `FeedPost` guarda `leagueId` (a
   * sala) e nada mais (`prisma/schema.prisma`, e o `getLeagueFeed` não
   * acrescenta campo nenhum de desafio). O cliente já foi tipado com um
   * `post.challenge: { id, title, counted }` que o servidor nunca mandou — o
   * campo saiu de `RoomFeedPost` junto com o resto da ficção.
   *
   * Deduzir daqui o desafio ativo da sala seria **afirmar uma atribuição que o
   * servidor não fez**: só ele sabe se aquela sessão contou. Então o chip fica
   * com o nome da sala e mais nada, e este campo volta a ter valor no dia em
   * que o feed mandar a atribuição.
   */
  challengeTitle: string | null;
  /** Prazo do desafio ativo da sala. Decide o destino de "Ver no feed". */
  challengeEndsAt: string | null;
  /** Última atividade da sala, o desempate quando nenhuma tem desafio. */
  lastPostAt: string | null;
  post: RoomFeedPost;
}

/**
 * Reconhece as cópias do post desta sessão nos feeds das salas.
 *
 * `feeds` é posicional: `feeds[i]` é o feed de `rooms[i]`, e `null` significa
 * que aquela sala falhou ao carregar. Falha de uma sala não pode derrubar as
 * outras — o post existe em todas, e mostrar duas de três é infinitamente
 * melhor que mostrar "não apareceu no feed" por causa de um timeout.
 */
export function collectSessionCopies(
  rooms: RoomSummary[],
  feeds: Array<RoomFeedPost[] | null>,
  sessionId: string,
): PublishedCopy[] {
  if (!sessionId) return [];
  const copies: PublishedCopy[] = [];

  rooms.forEach((room, index) => {
    const posts = feeds[index];
    if (!posts) return;
    const post = posts.find((item) => item.session?.id === sessionId);
    if (!post) return;
    copies.push({
      roomId: room.id,
      roomName: room.name,
      // A atribuição viria do post, não da sala — é o servidor quem decide se
      // esta sessão contou para o desafio daquela sala. Ele ainda não decide,
      // então não há o que afirmar. Ver `PublishedCopy.challengeTitle`.
      challengeTitle: null,
      challengeEndsAt: room.active_challenge?.ends_at ?? null,
      lastPostAt: room.last_post_at,
      post,
    });
  });

  return copies;
}

/**
 * A sala que "Ver no feed" abre (`FLUXO §7.1`).
 *
 * > Um botão, um destino: a sala com desafio ativo de prazo mais próximo; sem
 * > desafio em nenhuma, a de atividade mais recente.
 *
 * A ordem de `collectSessionCopies` é a ordem de `GET /rooms`, então o empate
 * cai sempre na mesma sala — o destino do botão não muda entre dois toques.
 */
export function pickPrimaryCopy(copies: PublishedCopy[]): PublishedCopy | null {
  if (copies.length === 0) return null;

  const withDeadline = copies.filter((copy) => copy.challengeEndsAt !== null);
  if (withDeadline.length > 0) {
    return withDeadline.reduce((best, copy) =>
      new Date(copy.challengeEndsAt!).getTime() < new Date(best.challengeEndsAt!).getTime()
        ? copy
        : best,
    );
  }

  const withActivity = copies.filter((copy) => copy.lastPostAt !== null);
  if (withActivity.length > 0) {
    return withActivity.reduce((best, copy) =>
      new Date(copy.lastPostAt!).getTime() > new Date(best.lastPostAt!).getTime() ? copy : best,
    );
  }

  return copies[0];
}

/**
 * O rótulo do chip de uma sala.
 *
 * `FLUXO §7.1`: "cada chip carrega a atribuição daquela sala quando houver
 * ('Cursinho · Sprint de Julho'), porque o desafio é por sala e o card é um só".
 */
export const copyChipLabel = (copy: PublishedCopy): string =>
  copy.challengeTitle ? `${copy.roomName} · ${copy.challengeTitle}` : copy.roomName;
