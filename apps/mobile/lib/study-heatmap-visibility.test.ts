import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const heatmap = readFileSync(
  new URL('../components/StudyHeatmap.tsx', import.meta.url).pathname,
  'utf8',
);

const ptBR = JSON.parse(
  readFileSync(new URL('../locales/pt-BR/profile.json', import.meta.url).pathname, 'utf8'),
);
const en = JSON.parse(
  readFileSync(new URL('../locales/en/profile.json', import.meta.url).pathname, 'utf8'),
);

/**
 * **Mapa quebrado não pode desenhar igual a mapa vazio.**
 *
 * O componente devolvia `null` para carregando, falhou e grade vazia de uma vez.
 * O efeito era que uma falha de rede tirava o bloco inteiro do perfil sem dizer
 * nada — indistinguível de "esta conta não tem mapa". É o mesmo defeito que fez
 * o feed passar semanas parecendo vazio, e ele reaparece toda vez que alguém
 * junta os estados num `return null` só. Estes testes existem para impedir isso.
 */
describe('StudyHeatmap — visibilidade da falha', () => {
  it('não colapsa "falhou" no mesmo return null de "carregando"', () => {
    // A forma exata que causou o defeito. Se ela voltar, o bloco some de novo.
    expect(heatmap).not.toMatch(/if\s*\(\s*carregando\s*\|\|\s*falhou/);
  });

  it('trata a falha antes de qualquer return null, e desenha algo', () => {
    const falha = heatmap.indexOf('if (falhou)');
    const primeiroNull = heatmap.indexOf('return null');

    expect(falha).toBeGreaterThan(-1);
    expect(falha).toBeLessThan(primeiroNull);
    // Não basta ramificar: o ramo tem que render texto.
    expect(heatmap.slice(falha, primeiroNull)).toContain("t('heatmapError')");
  });

  it('oferece uma saída — o aviso é tocável e refaz a busca', () => {
    expect(heatmap).toContain('onPress={carregar}');
    expect(heatmap).toContain("tc('retry')");
  });

  it('mantém o console.warn, que é o que diz o porquê a quem depura', () => {
    // O aviso na tela diz ao usuário QUE falhou; só o log diz o motivo.
    expect(heatmap).toContain('console.warn');
  });

  it('tem o texto de erro nas duas línguas', () => {
    // Sem a chave, o i18next imprime "heatmapError" cru na tela do usuário.
    expect(typeof ptBR.heatmapError).toBe('string');
    expect(typeof en.heatmapError).toBe('string');
    expect(ptBR.heatmapError).not.toBe(en.heatmapError);
  });
});
