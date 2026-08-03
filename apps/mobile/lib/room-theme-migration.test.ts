import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * As telas de sala que já viviam em `const COLORS` / `getColors(c)` e migraram.
 *
 * `app/league/[id].tsx` e `app/league/feed/[id].tsx` saíram da lista porque
 * saíram do repositório (`DESIGN-GYMRATS §3.4`): eram declaradas em `_layout`
 * mas nenhuma rota apontava para elas.
 */
const roomScreens = [
  '../app/league/create.tsx',
  '../app/league/join/[code].tsx',
  '../app/league/chat/[id].tsx',
  '../app/league/room/[id].tsx',
  '../app/league/details/[id].tsx',
  '../app/league/challenge/[id].tsx',
];

describe('room screen themes', () => {
  it.each(roomScreens)('%s reads the palette straight from useTheme()', (screen) => {
    const source = readFileSync(new URL(screen, import.meta.url).pathname, 'utf8');

    expect(source).toContain('useTheme');
    // O intermediário morreu junto com as telas legadas: `getColors(c)` estava
    // triplicado e trazia dois erros semânticos (`secondary: c.accent` e
    // `accent: c.danger`). Quem quiser uma cor lê o token pelo nome dele.
    expect(source).not.toContain('staticDark');
    expect(source).not.toContain('legacyColors');
    expect(source).not.toContain('const getColors');
  });

  it('keeps subject colors on the indicator instead of readable text', () => {
    const source = readFileSync(
      new URL('../components/feed/PostCard.tsx', import.meta.url).pathname,
      'utf8',
    );

    expect(source).toContain('styles.subjectDot');
    expect(source).toContain('<Text style={styles.subjectName}>');
    expect(source).not.toContain(
      'styles.subjectName, { color: post.subject_color',
    );
  });
});
