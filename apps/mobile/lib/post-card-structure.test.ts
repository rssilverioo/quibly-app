import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const postCard = readFileSync(
  new URL('../components/feed/PostCard.tsx', import.meta.url).pathname,
  'utf8',
);

describe('PostCard structure', () => {
  it('keeps the six brand blocks in their required order', () => {
    const renderedCard = postCard.slice(postCard.indexOf('const showProofPhoto'));
    const blocks = [
      'styles.proofPhoto',
      'styles.byline',
      'styles.subjectRow',
      'styles.dataRow',
      'styles.caption',
      'styles.challengeLine',
    ];

    const positions = blocks.map((block) => renderedCard.indexOf(block));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('keeps social chrome outside the card', () => {
    expect(postCard).not.toContain('ReactionEmoji');
    expect(postCard).not.toContain('comment_count ===');
    expect(postCard).not.toContain('getComments');
  });

  it('uses compact data pills and never labels an unverified post', () => {
    expect(postCard).not.toContain('text.display');
    expect(postCard).not.toContain('text.title1');
    expect(postCard).not.toMatch(/não verificado|not verified/i);
    expect(postCard).toContain('post.is_verified ?');
    expect(postCard).toContain('styles.minutesText');
  });

  it('renders proof photos only when a real URL is visible', () => {
    expect(postCard).toContain(
      'post.show_proof_photo && Boolean(post.proof_photo_url)',
    );
    expect(postCard).not.toContain('proofSubmitted');
  });
});
