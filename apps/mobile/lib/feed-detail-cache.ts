import type { FirebaseFeedPost } from '../components/feed/PostCard';

const posts = new Map<string, FirebaseFeedPost>();

export const cacheFeedPost = (post: FirebaseFeedPost) => posts.set(post.id, post);
export const getCachedFeedPost = (postId: string) => posts.get(postId);
