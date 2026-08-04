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

const telaDaSala = readFileSync(
  new URL('../app/league/room/[id].tsx', import.meta.url).pathname,
  'utf8',
);

/**
 * Os dois defeitos que o dono do produto viu na tela em 04/08, olhando o feed
 * da sala `Teste`.
 */
describe('a linha do feed desenha uma moldura, não duas', () => {
  it('leaves the frame to FeedRow, which is the one measured off the reference', () => {
    // 72pt externos com borda de 1px dão os 69,9pt internos do GymRats. Recriar
    // a moldura no recipiente empurrava o card real para 74pt e afinava a linha
    // para 382pt dentro de 408.
    expect(row).toContain('backgroundColor: c.surface');
    expect(row).toContain('borderWidth: 1');
  });

  it('keeps the room wrapper to spacing only', () => {
    const wrapper = telaDaSala.slice(
      telaDaSala.indexOf('postCard:'),
      telaDaSala.indexOf('postCard:') + 120,
    );
    expect(wrapper).toContain('marginBottom');
    // O padding horizontal cobrado duas vezes era metade do sintoma.
    expect(wrapper).not.toContain('borderWidth');
    expect(wrapper).not.toContain('backgroundColor');
    expect(wrapper).not.toContain('paddingLeft');
  });
});

describe('miniatura que falha vira ladrilho, não buraco', () => {
  it('falls back to the tile when the image errors', () => {
    // `styles.thumbnail` não tem cor de fundo: sem isto, uma imagem que falha
    // fica transparente e a linha COM foto é a que parece não ter miniatura.
    expect(row).toContain('onError');
    expect(row).toContain('mostraFoto');
  });

  it('does not let an old failure condemn a new photo', () => {
    expect(row).toContain('useEffect(() => { setFalhou(false); }, [photo]);');
  });
});
