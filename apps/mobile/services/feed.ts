import { api } from '../lib/api';
import type { FeedPost, FeedComment, ReactionEmoji } from '@quibly/shared';

export async function getFeedPosts(
  leagueId: string,
  limitCount = 20,
  page = 1
): Promise<any[]> {
  const result = await api.get<{ posts: any[] }>(
    `/feed/${leagueId}?page=${page}&limit=${limitCount}`
  );
  return result.posts;
}

export async function toggleReaction(
  _leagueId: string,
  postId: string,
  emoji: ReactionEmoji,
  _userId?: string
) {
  return api.post(`/feed/${postId}/react`, { emoji });
}

export async function addComment(
  _leagueId: string,
  postId: string,
  _userId: string,
  content: string
): Promise<FeedComment> {
  return api.post<FeedComment>(`/feed/${postId}/comment`, { content });
}

export async function getComments(
  _leagueId: string,
  postId: string,
  page = 1,
  limit = 20
): Promise<FeedComment[]> {
  const result = await api.get<{ comments: FeedComment[] }>(
    `/feed/${postId}/comments?page=${page}&limit=${limit}`
  );
  return result.comments;
}

export async function toggleProofPhotoVisibility(postId: string) {
  return api.patch(`/feed/${postId}/proof-visibility`);
}
