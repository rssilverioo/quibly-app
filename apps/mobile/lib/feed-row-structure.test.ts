import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { feedDayLabel, startsNewFeedDay } from './feed-post';

const row = readFileSync(
  new URL('../components/feed/FeedRow.tsx', import.meta.url).pathname,
  'utf8',
);

describe('compact room feed', () => {
  it('keeps the owner-approved 72/56/18 geometry', () => {
    expect(row).toContain("height: 72");
    expect(row).toContain("width: 56, height: 56");
    expect(row).toContain("size={18}");
  });

  it('uses the static idle castle when a post has no photo', () => {
    expect(row).toContain('state="idle" size={34} plate={false} animate={false}');
    expect(row).not.toContain('<PostCard');
  });

  it('groups posts under calendar-day separators', () => {
    const posts = [
      { created_at: '2026-07-30T18:00:00Z' },
      { created_at: '2026-07-30T12:00:00Z' },
      { created_at: '2026-07-29T12:00:00Z' },
    ] as any;
    expect(posts.map((_: unknown, index: number) => startsNewFeedDay(posts, index)))
      .toEqual([true, false, true]);
    expect(feedDayLabel('2026-07-30T12:00:00Z', 'en', new Date('2026-07-31T15:00:00Z')))
      .toBe('Yesterday');
  });
});
