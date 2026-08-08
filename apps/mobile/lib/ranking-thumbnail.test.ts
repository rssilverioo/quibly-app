import { describe, expect, it } from 'vitest';

import { rankingThumbnailUrl } from './ranking-thumbnail';

describe('rankingThumbnailUrl', () => {
  it('prefers the latest challenge photo', () => {
    expect(rankingThumbnailUrl({ latest_photo_url: 'post.jpg', avatar_url: 'avatar.jpg' })).toBe('post.jpg');
  });

  it('falls back through avatar to nothing', () => {
    expect(rankingThumbnailUrl({ latest_photo_url: null, avatar_url: 'avatar.jpg' })).toBe('avatar.jpg');
    expect(rankingThumbnailUrl({ latest_photo_url: null, avatar_url: null })).toBeNull();
  });
});
