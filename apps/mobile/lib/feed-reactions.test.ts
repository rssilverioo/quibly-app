import { describe, expect, it } from 'vitest';
import { roomFeedPostToCardPost } from './feed-post';
import type { RoomFeedPost } from '../services/rooms';

const base = {
  id: 'p1',
  created_at: '2026-07-30T12:00:00Z',
  author: { user_id: 'u9', display_name: 'Ana', avatar_url: null },
  show_proof_photo: true,
  photo_url: 'https://example.test/a.jpg',
  comment_count: 0,
  caption: 'Climb',
} as unknown as RoomFeedPost;

const post = (reactions: Record<string, number>, mine: string[] = []) =>
  ({ ...base, reactions, user_reactions: mine }) as RoomFeedPost;

describe('room reactions -> card reactions', () => {
  it('keeps the count the API reported', () => {
    const card = roomFeedPostToCardPost(post({ '🔥': 3, '👏': 1 }), 'room1', 'me');
    expect(card.reactions['🔥']).toHaveLength(3);
    expect(card.reactions['👏']).toHaveLength(1);
  });

  it('puts the current user in the list for their own reactions, exactly once', () => {
    const card = roomFeedPostToCardPost(post({ '🔥': 3 }, ['🔥']), 'room1', 'me');
    // The pill reads as selected via includes(currentUserId), and the count
    // must not grow just because we know it was us.
    expect(card.reactions['🔥']).toContain('me');
    expect(card.reactions['🔥'].filter((id) => id === 'me')).toHaveLength(1);
    expect(card.reactions['🔥']).toHaveLength(3);
  });

  it('leaves the user out of reactions they did not make', () => {
    const card = roomFeedPostToCardPost(post({ '🔥': 2, '👏': 1 }, ['👏']), 'room1', 'me');
    expect(card.reactions['🔥']).not.toContain('me');
    expect(card.reactions['👏']).toContain('me');
  });

  it('handles a solo reaction by the current user', () => {
    const card = roomFeedPostToCardPost(post({ '🔥': 1 }, ['🔥']), 'room1', 'me');
    expect(card.reactions['🔥']).toEqual(['me']);
  });

  it('drops emojis at zero and survives a post with no reaction fields', () => {
    expect(roomFeedPostToCardPost(post({ '🔥': 0 }), 'r', 'me').reactions).toEqual({});
    const bare = { ...base } as RoomFeedPost;
    expect(roomFeedPostToCardPost(bare, 'r', 'me').reactions).toEqual({});
  });
});
