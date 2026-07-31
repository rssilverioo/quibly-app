import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const roomScreens = [
  '../app/league/[id].tsx',
  '../app/league/create.tsx',
  '../app/league/feed/[id].tsx',
  '../app/league/join/[code].tsx',
];

describe('room screen themes', () => {
  it.each(roomScreens)('%s follows the active semantic palette', (screen) => {
    const source = readFileSync(new URL(screen, import.meta.url).pathname, 'utf8');

    expect(source).toContain('useTheme');
    expect(source).not.toContain('staticDark');
    expect(source).toContain('surface: c.surface');
    expect(source).toContain('border: c.border');
    expect(source).toContain('success: c.success');
    expect(source).toContain('textSecondary: c.fgMuted');
    expect(source).toContain('textMuted: c.fgSubtle');
    expect(source).toContain('c.fgOnAccent');
  });

  it('keeps subject colors on the indicator instead of readable text', () => {
    const source = readFileSync(
      new URL('../app/league/feed/[id].tsx', import.meta.url).pathname,
      'utf8',
    );

    expect(source).toContain('styles.subjectDot');
    expect(source).toContain('<Text style={styles.subjectText}>');
    expect(source).not.toContain(
      'styles.subjectText, { color: post.subject_color',
    );
  });
});
