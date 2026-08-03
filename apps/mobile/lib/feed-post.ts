import type { FirebaseFeedPost } from '../components/feed/PostCard';
import type { ChallengeMemberPostsPage, RoomFeedPage, RoomFeedPost } from '../services/rooms';

/**
 * O servidor manda o feed em **dois envelopes diferentes** conforme a rota:
 * `GET /rooms/:id/feed` responde `{ posts }` e
 * `GET /challenges/:id/members/:user_id/posts` responde `{ items }`. Ver o
 * quadro em `services/rooms.ts`.
 *
 * Esta função existe para que nenhuma tela precise saber disso. Ela também
 * tolera resposta malformada devolvendo `[]` em vez de estourar — mas quem
 * chama continua responsável por **não confundir vazio com quebrado**: ver o
 * `catch` de `app/league/room/[id].tsx`.
 */
export function feedPagePosts(
  page: RoomFeedPage | ChallengeMemberPostsPage | null | undefined,
): RoomFeedPost[] {
  if (!page) return [];
  const envelope = page as Partial<RoomFeedPage> & Partial<ChallengeMemberPostsPage>;
  if (Array.isArray(envelope.posts)) return envelope.posts;
  if (Array.isArray(envelope.items)) return envelope.items;
  return [];
}

/**
 * The two sides count reactions differently. The room API sends
 * `{ '🔥': 3 }` plus `user_reactions: ['🔥']`; the card wants
 * `{ '🔥': [user_id, …] }`, using the array length as the count and
 * `includes(currentUserId)` to decide whether the pill reads as selected.
 *
 * Passing `currentUserId` lets us rebuild a list that satisfies both. The
 * filler ids are synthetic — the API never sends who reacted, only how many —
 * so they are only ever counted, never displayed or compared to a real id.
 */
function expandReactions(
  counts: Record<string, number> | undefined,
  mine: string[] | undefined,
  currentUserId: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [emoji, count] of Object.entries(counts ?? {})) {
    if (count <= 0) continue;
    const reactedByMe = (mine ?? []).includes(emoji);
    const others = Array.from(
      { length: reactedByMe ? count - 1 : count },
      (_, i) => `anon:${emoji}:${i}`,
    );
    out[emoji] = reactedByMe && currentUserId ? [currentUserId, ...others] : others;
  }
  return out;
}

/**
 * Traduz o post **como o servidor o manda** para o `FirebaseFeedPost` que as
 * telas desenham. É o único ponto de tradução do produto — `FeedRow`, `PostCard`
 * e a tela de detalhe só conhecem o lado de cá.
 *
 * O lado de lá é o feed legado da liga, em camelCase do Prisma; o porquê e o
 * mapa campo a campo estão em `services/rooms.ts`. Aqui ficam só as três
 * decisões que **não** são renomear campo:
 *
 * 1. **A foto não depende de `show_proof_photo`.** O servidor entrega
 *    `photo_url = post.photo_url ?? proof_photo_url`, e `proof_photo_url` já nasce
 *    `null` quando a flag é falsa. Isto é: a flag governa a foto **de prova de
 *    sessão**, e o servidor já a aplicou. Num post de foto avulsa
 *    (`POST /rooms/:id/posts`) `photo_url` vem preenchido e `show_proof_photo`
 *    vem `false`, porque a coluna tem `@default(false)` e essa rota nunca a
 *    escreve. Deixar a flag decidir era exatamente o defeito nomeado em
 *    `PLANO §Etapa 2` — "mostrava 'prova enviada' … e nunca exibia a foto".
 *    Por isso `show_proof_photo` do card sai de `Boolean(photo_url)`: do lado de
 *    cá a flag significa "há foto para mostrar", que é o único uso que
 *    `FeedRow` e `PostCard` fazem dela.
 *
 * 2. **`comment_count` satura em 3.** O servidor não manda contagem de
 *    comentários — manda `latest_comments`, e com `take: 3`. Então 3 aqui quer
 *    dizer "três ou mais". É um número honesto e limitado; a alternativa era um
 *    número errado sem aviso. Some no dia em que o servidor mandar `_count`.
 *
 * 3. **`challenge_title` fica sempre indefinido.** O contrato não tem campo de
 *    desafio: `FeedPost` guarda `league_id` (a sala), e não a atribuição a um
 *    desafio. Inventar aqui seria afirmar uma atribuição que o servidor não
 *    fez.
 */
export function roomFeedPostToCardPost(
  post: RoomFeedPost,
  roomId = '',
  currentUserId = '',
): FirebaseFeedPost {
  // As duas grafias convivem porque as duas rotas divergem — ver `services/rooms.ts`.
  const myReactions = post.user_reactions ?? post.user_reactions;
  const comments = post.latest_comments ?? post.latest_comments;
  const photo_url = post.photo_url ?? null;

  return {
    id: post.id,
    // O servidor já calcula `kind`; a sessão é o desempate se ele faltar.
    kind: post.kind ?? (post.session ? 'session' : 'standalone'),
    // `league_id` do post é a sala. O `roomId` recebido só serve de reserva para
    // quando quem chama não tem o post no contexto de uma sala.
    league_id: post.league_id ?? roomId,
    user_id: post.user_id,
    username: post.user?.username ?? '',
    avatar_url: post.user?.avatar_url ?? null,
    session_id: post.session?.id ?? '',
    subject_id: post.session?.subject?.id ?? '',
    subject_name: post.session?.subject?.name ?? '',
    subject_color: post.session?.subject?.color ?? '',
    // Ver a decisão (1) no cabeçalho: a flag do servidor não entra aqui.
    show_proof_photo: Boolean(photo_url),
    proof_photo_url: photo_url,
    total_duration_minutes: post.session?.minutes,
    // `xp_earned` e não `points_earned`: o pill do card lê "+N XP".
    points_earned: post.session?.xp_earned,
    is_verified: post.session?.is_verified ?? false,
    reactions: expandReactions(post.reactions, myReactions, currentUserId),
    comment_count: comments?.length ?? 0,
    created_at: post.created_at,
    caption: post.caption,
  };
}

export function feedDayLabel(iso: string, locale: string, now = new Date()): string {
  const date = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((start.getTime() - target.getTime()) / 86_400_000);
  if (days === 0) return locale.startsWith('pt') ? 'Hoje' : 'Today';
  if (days === 1) return locale.startsWith('pt') ? 'Ontem' : 'Yesterday';
  return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
}

export const startsNewFeedDay = (posts: FirebaseFeedPost[], index: number): boolean => {
  if (index === 0) return true;
  return new Date(posts[index].created_at).toDateString()
    !== new Date(posts[index - 1].created_at).toDateString();
};
