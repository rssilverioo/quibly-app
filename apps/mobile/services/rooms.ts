import { api } from '../lib/api';

export interface ActiveChallenge {
  id: string;
  title: string;
  metric_unit: string;
  ends_at: string;
  server_time: string;
  participant_count: number;
  participation_mode?: 'photo' | 'study';
  leader?: { display_name: string; metric_value: number; avatar_url?: string | null } | null;
  me: { rank: number | null; metric_value: number; goal_progress?: number | null };
}

export interface RoomSummary {
  id: string;
  name: string;
  /** O texto do desafio. O servidor sempre mandou; o tipo não declarava. */
  description?: string | null;
  /** Papel de quem pediu — `owner` destrava a edição da sala. */
  my_membership?: { role: string; display_name: string };
  member_count: number;
  total_sp: number;
  last_post_at: string | null;
  unread_posts: number;
  cover_url?: string | null;
  active_challenge: ActiveChallenge | null;
}

/* ===================================================================== *
 *  O FEED DA SALA — o contrato real, não o desejado
 * ===================================================================== *
 *
 * **Tudo daqui para baixo é camelCase do Prisma, e isso não é descuido.**
 *
 * `GET /rooms/:id/feed` não tem serviço próprio: o `RoomsController.feed`
 * delega direto para `feedService.getLeagueFeed(roomId, …)`
 * (`apps/api/src/rooms/rooms.controller.ts`). Ou seja, a sala herdou o feed
 * **legado da liga** inteiro — envelope, nomes de campo e tudo. O servidor
 * espalha o registro do Prisma com `...post` e só acrescenta alguns campos
 * calculados por cima; nada é reprojetado para snake_case.
 *
 * Este bloco já foi tipado contra um contrato snake_case (`items`, `author`,
 * `photo_url`, `comment_count`, `challenge`) que **o servidor nunca
 * implementou**. O resultado foi um feed que ficou vazio em silêncio por
 * semanas: `page.items` era `undefined`, o `.map()` estourava e um `catch` sem
 * corpo engolia o erro. Se um dia alguém sentir vontade de "arrumar os nomes",
 * arrume **no servidor** — e só então aqui.
 *
 * ## Duas rotas, dois envelopes — e eles NÃO batem
 *
 * Este é o detalhe que mais custa caro, e ele é real (conferido em
 * `apps/api/src/feed/feed.service.ts`, `origin/main`):
 *
 * | | `getLeagueFeed` (usado por `/rooms/:id/feed`) | `getChallengeMemberPosts` |
 * |---|---|---|
 * | envelope | `{ posts, … }` | `{ items, … }` |
 * | reações minhas | `user_reactions` | `user_reactions` |
 * | comentários | `latest_comments` | `latest_comments` |
 *
 * Os dois métodos foram escritos em momentos diferentes e ninguém unificou.
 * Por isso `RoomFeedPost` aceita as **duas** grafias como opcionais e existe
 * `feedPagePosts()` em `lib/feed-post.ts`: nenhuma tela deve escolher entre
 * `.posts` e `.items` na mão outra vez.
 */

/** Autor do post. Note que o id do usuário **não** mora aqui: está em `RoomFeedPost.user_id`. */
export interface RoomFeedUser {
  /**
   * O servidor já substitui isto pelo `display_name` da membresia naquela sala
   * quando existe um. Então é o nome a exibir, não o handle global.
   */
  username: string;
  handle: string;
  avatar_url: string | null;
  /**
   * O selo, quando há. Concedido pelo painel e nunca comprável — ver
   * `components/ui/SeloVerificado`.
   */
  verification?: 'BLUE' | 'GOLD' | null;
}

/** Comentário do bloco `latest_comments` — no máximo 3, ver `RoomFeedPost`. */
export interface RoomFeedComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: RoomFeedUser;
}

/** A sessão de estudo por trás de um post `kind: 'session'`. */
export interface RoomFeedSession {
  id: string;
  /**
   * `Decimal` do Prisma — chega como **string** no JSON. Use `minutes`, que é
   * o mesmo valor já passado por `Number()` do lado do servidor.
   */
  total_duration_minutes: string | number;
  minutes: number;
  points_earned: number;
  xp_earned: number;
  is_verified: boolean;
  proof_mode: boolean;
  subject: { id: string; name: string; color: string };
  /** A prova aprovada, quando há. Já resolvida em `proof_photo_url`. */
  proof_checks: Array<{ photo_url: string | null }>;
  /**
   * `show_proof_photo ? proof_checks[0]?.photo_url : null`, calculado pelo servidor.
   * É a foto **de prova de sessão** — não é a foto de um post avulso.
   */
  proof_photo_url: string | null;
}

export interface RoomFeedPost {
  id: string;
  /** A sala. O servidor ainda chama de liga, porque sala **é** uma `League`. */
  league_id: string;
  session_id: string | null;
  user_id: string;
  kind: 'session' | 'standalone';
  caption: string | null;
  /**
   * **Já resolvida pelo servidor**: `post.photo_url ?? proof_photo_url`. Ou seja,
   * esta é a foto a exibir, venha ela de um post de foto avulsa ou da prova de
   * uma sessão. Ver a nota de `show_proof_photo` logo abaixo — ela existe, mas
   * não é ela que decide se há foto.
   */
  photo_url: string | null;
  /**
   * Governa **apenas** a foto de prova da sessão, e o servidor já a aplicou ao
   * montar `photo_url` e `session.proof_photo_url`. Para um post de foto avulsa
   * ela vem `false` mesmo havendo foto — é o valor padrão da coluna
   * (`FeedPost.show_proof_photo @default(false)`), e o `POST /rooms/:id/posts`
   * nunca a escreve.
   *
   * **Não use esta flag para decidir se mostra a foto.** Quem decide é
   * `photo_url`. Foi essa confusão que fez todo post de foto cair no ladrilho do
   * mascote. A tradução para o card acontece em `lib/feed-post.ts`.
   */
  show_proof_photo: boolean;
  created_at: string;
  user: RoomFeedUser;
  session: RoomFeedSession | null;
  /** `{ emoji: quantidade }`. Este bate com o que o cliente sempre esperou. */
  reactions: Record<string, number>;

  /**
   * Os emojis com que **eu** reagi. Os dois métodos do servidor escrevem esta
   * chave diferente na fonte (`user_reactions` e `userReactions`), mas o
   * `SnakeCaseInterceptor` achata as duas para cá — por isso é um campo só.
   */
  user_reactions?: string[];

  /**
   * **Satura em 3**: o servidor faz `take: 3` na relação de comentários. Não
   * existe contagem total no contrato — `comment_count` do card sai do
   * comprimento deste array e por isso nunca passa de 3.
   */
  latest_comments?: RoomFeedComment[];
}

/**
 * `GET /rooms/:id/feed` — envelope `posts`.
 *
 * Não é `items`. Já foi tipado como `items` e o feed ficou vazio por semanas.
 */
export interface RoomFeedPage {
  posts: RoomFeedPost[];
  total: number;
  page: number;
  limit: number;
}

/**
 * `GET /challenges/:id/members/:user_id/posts` — envelope `items`.
 *
 * Sim, é diferente do de cima, e sim, é o mesmo tipo de post. Ver o quadro no
 * cabeçalho deste bloco.
 */
export interface ChallengeMemberPostsPage {
  items: RoomFeedPost[];
  total: number;
  page: number;
  limit: number;
}

export const getMyRooms = (): Promise<RoomSummary[]> => api.get('/rooms');

/**
 * Sala recém-criada. Note o camelCase: diferente do resto deste arquivo, o
 * `POST /rooms` devolve o objeto do Prisma quase cru, e não a projeção
 * snake_case que as rotas de leitura montam.
 */
export interface CreatedRoom {
  id: string;
  name: string;
  invite_code: string;
  max_members: number;
  created_at: string;
  /** Não-nulo desde 04/08: a sala nasce com o desafio. Ver `createRoom`. */
  active_challenge: ActiveChallenge | null;
  my_membership: { role: string; display_name: string };
}

/**
 * Criar sala **é** criar o desafio.
 *
 * ~~"Criar sala pergunta duas coisas, e é assim de propósito
 * (`DESIGN-GYMRATS §5.6`): prazo, modo e tamanho do grupo são propriedades do
 * desafio, não da sala."~~ **Revogado em 04/08/2026 pelo dono do produto.**
 *
 * A separação era defensável no papel e péssima na mão: a sala nascia sem
 * desafio, e como `isStudyChallenge(null)` é falso, ela nascia **sem botão de
 * timer e sem faixa de "estudando agora"**. Ou seja, tudo que nos diferencia do
 * GymRats ficava atrás de um segundo passo que nenhuma tela pedia — e a sala
 * recém-criada era um GymRats pior, sem a parte que é nossa.
 *
 * O GymRats, que é a referência, faz num fluxo só: criar o grupo é configurar
 * o desafio. `DIRECAO-PRODUTO` já dizia que "a escolha acontece uma vez"; só
 * tinha suposto que a porta era a tela de desafio. É a mesma regra, na porta
 * certa.
 *
 * Os dois campos novos são opcionais no servidor de propósito: a build 1.2.1
 * está em campo mandando só os dois primeiros, e para ela nada muda.
 */
export const createRoom = (
  name: string,
  display_name: string,
  duration_days: number,
): Promise<CreatedRoom> =>
  api.post('/rooms', { name, display_name, duration_days });

export const getRoomFeed = (roomId: string): Promise<RoomFeedPage> =>
  api.get(`/rooms/${roomId}/feed?page=1&limit=20`);

export interface PostPhotoFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * O post recém-criado. **Não é um `RoomFeedPost`**: o `rooms.service.createPost`
 * devolve um resumo curto, montado à mão, sem `user`, sem `reactions` e sem
 * `session`. Para desenhar o post é preciso reler o feed.
 */
export interface CreatedRoomPost {
  id: string;
  roomId: string;
  kind: 'standalone';
  caption: string | null;
  photo_url: string | null;
  created_at: string;
}

/** O que o dono pode mudar. A data não entra — ver `UpdateRoomDto` na API. */
export function updateRoom(roomId: string, data: { name?: string; description?: string }) {
  return api.patch<{ id: string; name: string; description: string | null; cover_url: string | null }>(
    `/rooms/${roomId}`,
    data,
  );
}

/**
 * Troca a capa da sala.
 *
 * Mesmo formato do post de foto: `FormData` com o arquivo, porque é upload e
 * não JSON. O campo se chama `cover` — é o nome que o `FileInterceptor` da API
 * espera, e errar aqui produz um 400 sem pista nenhuma.
 */
export function updateRoomCover(roomId: string, photo: PostPhotoFile) {
  const formData = new FormData();
  formData.append('cover', photo as any);
  return api.upload<{ id: string; cover_url: string | null }>(`/rooms/${roomId}/cover`, formData);
}

/** Apaga a sala. Irreversível, e é o caminho oficial para trocar a data. */
export function deleteRoom(roomId: string) {
  return api.delete<{ deleted: boolean }>(`/rooms/${roomId}`);
}

export function createRoomPost(roomId: string, photo: PostPhotoFile, caption: string) {
  const formData = new FormData();
  formData.append('photo', photo as any);
  if (caption.trim()) formData.append('caption', caption.trim());
  return api.upload<CreatedRoomPost>(`/rooms/${roomId}/posts`, formData);
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  /** O selo, quando há. Ver `components/ui/SeloVerificado`. */
  verification?: 'BLUE' | 'GOLD' | null;
  metric_value: number;
  minutes: number;
  sessions: number;
  active_days: number;
  latest_photo_url: string | null;
}

export interface ChallengeLeaderboard {
  challenge: ActiveChallenge;
  entries: LeaderboardEntry[];
  me: { rank: number | null; metric_value: number };
  total: number;
}

export const getChallengeLeaderboard = (challengeId: string): Promise<ChallengeLeaderboard> =>
  api.get(`/challenges/${challengeId}/leaderboard?page=1&limit=50`);

export interface CreateChallengeInput {
  title: string;
  metric: 'minutes';
  ends_on: string;
  // `participation_mode` saiu em 04/08/2026, com o conceito de modo. O servidor
  // ainda aceita o campo — a coluna tem `@default('photo')` e ninguém mais a lê
  // —, mas nenhuma tela o envia. Ver `ActiveChallenge.participation_mode`.
}

export const createChallenge = (roomId: string, input: CreateChallengeInput) =>
  api.post<ActiveChallenge>(`/rooms/${roomId}/challenges`, input);

export const getChallengeMemberPosts = (
  challengeId: string,
  user_id: string,
  page = 1,
  limit = 20,
): Promise<ChallengeMemberPostsPage> => api.get(
  `/challenges/${challengeId}/members/${user_id}/posts?page=${page}&limit=${limit}`,
);

/**
 * O que `GET /rooms/:id/details` devolve **no fio**, não o que seria bonito
 * receber.
 *
 * Três campos estavam declarados com nome que o servidor nunca mandou, e
 * `undefined` não quebra nada em JS — a tela só ficava vazia:
 *
 * | Estava escrito aqui | O servidor manda |
 * |---|---|
 * | `invite_code` na raiz | `room.invite_code` |
 * | `total_active_days` | `total_days_active` |
 * | `most_early_bird` / `most_night_owl` | `early_bird` / `night_owl` |
 *
 * O código de convite aparecia em branco e o link de compartilhar saía como
 * `.../join/undefined`; o card de dias ativos ficava vazio; madrugador e
 * coruja nunca renderizavam, porque o `?` de existência dava falso nos dois.
 *
 * Saíram também `challenge.room_id`, `title` e `participation_mode`: nenhum
 * dos três vem em `details`, e nenhuma tela os lê. Declarar campo que não
 * chega é o que faz o próximo leitor confiar num contrato que não existe.
 * O contrato real sai em snake_case por causa do `SnakeCaseInterceptor`
 * global (`apps/api/src/main.ts`), e é ele — não a assinatura do service —
 * que manda aqui.
 */
export interface ChallengeDetails {
  room: {
    id: string;
    name: string;
    invite_code: string;
  };
  challenge: {
    id: string;
    starts_at: string;
    ends_at: string;
    server_time: string;
    elapsed_fraction: number;
  };
  rankings: Array<{
    rank: number;
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    active_days: number;
  }>;
  group_stats: {
    total_check_ins: number;
    total_days_active: number;
    average_check_ins_per_day: number;
    early_bird: null | { user_id: string; display_name: string; avatar_url: string | null; check_ins: number };
    night_owl: null | { user_id: string; display_name: string; avatar_url: string | null; check_ins: number };
  };
}

export const getRoomDetails = (roomId: string): Promise<ChallengeDetails> =>
  api.get(`/rooms/${roomId}/details`);
