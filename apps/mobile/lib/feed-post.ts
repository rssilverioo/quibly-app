import type { FirebaseFeedPost } from '../components/feed/PostCard';
import type { RoomFeedPost } from '../services/rooms';

/**
 * The two sides count reactions differently. The room API sends
 * `{ '🔥': 3 }` plus `user_reactions: ['🔥']`; the card wants
 * `{ '🔥': [userId, …] }`, using the array length as the count and
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

export function roomFeedPostToCardPost(
  post: RoomFeedPost,
  roomId = '',
  currentUserId = '',
): FirebaseFeedPost {
  return {
    id: post.id,
    kind: post.session ? 'session' : 'standalone',
    league_id: roomId,
    user_id: post.author.user_id,
    username: post.author.display_name,
    avatar_url: post.author.avatar_url,
    session_id: post.session?.id ?? '',
    subject_id: '',
    subject_name: post.session?.subject.name ?? '',
    subject_color: post.session?.subject.color ?? '',
    show_proof_photo: post.show_proof_photo,
    proof_photo_url: post.photo_url,
    total_duration_minutes: post.session?.minutes,
    points_earned: post.session?.xp_earned,
    is_verified: post.session?.is_verified ?? false,
    reactions: expandReactions(post.reactions, post.user_reactions, currentUserId),
    comment_count: post.comment_count,
    created_at: post.created_at,
    caption: post.caption,
    challenge_title: post.challenge?.title,
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
