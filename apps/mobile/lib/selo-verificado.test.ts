import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const selo = ler('../components/ui/SeloVerificado.tsx');

/**
 * O selo diz "é mesmo essa pessoa", e é o fato de **não ser vendável** que o
 * mantém dizendo isso. Um selo comprável passa a dizer "pagou" e vira ruído.
 */
describe('o selo de verificado', () => {
  it('tem os dois níveis, e o dourado é o de professor', () => {
    expect(selo).toContain("'BLUE'");
    expect(selo).toContain("'GOLD'");
  });

  /**
   * Um selo só funciona se for reconhecido antes de ser lido. As duas cores já
   * carregam significado para quem usa qualquer rede — inventar a nossa seria
   * pedir que a pessoa aprendesse um vocabulário para uma informação de meio
   * segundo.
   */
  it('usa o azul do Instagram e o dourado do X', () => {
    expect(selo).toContain('#1D9BF0');
    expect(selo).toContain('#E8B923');
  });

  /**
   * ✅ e ☑️ mudam de forma em cada sistema e em cada versão, e dourado não
   * existe como emoji. Desenhado, o símbolo é o mesmo no iOS, no Android e no
   * painel que o concede.
   */
  it('é desenhado, e não um emoji', () => {
    expect(selo).toContain('react-native-svg');
    expect(semComentarios(selo)).not.toMatch(/[✅☑️✓]/u);
  });

  it('sem selo não desenha nada', () => {
    // `null` é o estado da esmagadora maioria: qualquer coisa renderizada aí
    // vira espaço morto ao lado de todo nome do app.
    expect(selo).toContain('if (!selo) return null;');
  });

  /**
   * Nos quatro lugares onde uma pessoa vê outra. Um selo que aparece em uma
   * tela e some na seguinte não é um selo — é um detalhe do feed.
   */
  it('aparece onde as pessoas se veem: feed, chat, ranking e perfil', () => {
    for (const tela of [
      '../components/feed/FeedRow.tsx',
      '../app/league/chat/[id].tsx',
      '../app/league/challenge/[id].tsx',
      '../app/(tabs)/profile.tsx',
    ]) {
      expect(ler(tela)).toContain('<SeloVerificado');
    }
  });
});

/**
 * A bio era escrita e nunca aparecia.
 *
 * O campo existe no banco desde sempre e `profile/edit` já pedia por ele —
 * mas nenhuma tela o mostrava. Quem escrevia uma via o texto sumir, o que é
 * pior que não ter o campo: o app pediu uma informação e a jogou fora.
 */
describe('a bio', () => {
  it('é pedida na edição e mostrada no perfil', () => {
    expect(ler('../app/profile/edit.tsx')).toContain('bio');
    expect(ler('../app/(tabs)/profile.tsx')).toContain('profile.bio');
  });
});
