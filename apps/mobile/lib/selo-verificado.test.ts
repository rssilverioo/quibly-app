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

  it('aparece ao lado do nome no feed', () => {
    expect(ler('../components/feed/FeedRow.tsx')).toContain('<SeloVerificado');
  });
});
