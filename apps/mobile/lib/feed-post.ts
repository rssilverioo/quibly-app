import type { FirebaseFeedPost } from '../components/feed/PostCard';
import type { RoomFeedPost } from '../services/rooms';

export function roomFeedPostToCardPost(post: RoomFeedPost, roomId = ''): FirebaseFeedPost {
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
    reactions: {},
    comment_count: post.comment_count,
    created_at: post.created_at,
    caption: post.caption,
    challenge_title: post.challenge?.title,
  };
}
