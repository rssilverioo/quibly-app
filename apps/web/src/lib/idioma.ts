import type { Lang } from '../components/landing/content';

/**
 * Qual idioma usar, a partir do `Accept-Language` de quem pediu a página.
 *
 * ## Por que aqui não dá para escolher pela rota
 *
 * A landing resolve isso com duas rotas — `/` em inglês e `/pt` em português —
 * e funciona porque quem chega vem de um link que **nós** escolhemos.
 *
 * O convite não: `tryquibly.com/join/CODE` é **um link só**, gerado pelo app de
 * quem convida e colado num grupo onde pode ter gente de qualquer lugar. Quem
 * escolhe o idioma tem que ser o navegador de quem abre, não o telefone de quem
 * mandou.
 *
 * ## Por que inglês é o padrão
 *
 * Mesma decisão dos textos de notificação: o desconhecido é o mundo, não o
 * Brasil. Cair em português para quem não pediu português deixa a página
 * ilegível para a maioria; cair em inglês deixa a página legível para quase
 * todo mundo, inclusive para boa parte de quem preferia português.
 */
export function idiomaAceito(cabecalho: string | null | undefined): Lang {
  if (!cabecalho) return 'en';

  const preferencias = cabecalho
    .split(',')
    .map((parte, ordem) => {
      const [etiqueta, ...parametros] = parte.trim().split(';');
      const q = parametros
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const peso = q === undefined ? 1 : Number.parseFloat(q);
      return {
        // `pt-BR` e `pt-PT` são a mesma escolha para nós: o que importa é a
        // subetiqueta primária.
        base: etiqueta.trim().toLowerCase().split('-')[0],
        // `q` inválido vira 0 e não 1: um valor que não é número não é um
        // pedido, e tratá-lo como preferência máxima inverteria a ordem.
        peso: Number.isFinite(peso) ? peso : 0,
        ordem,
      };
    })
    // `q` igual mantém a ordem do cabeçalho, que é a ordem da preferência.
    .sort((a, b) => b.peso - a.peso || a.ordem - b.ordem);

  for (const { base, peso } of preferencias) {
    // `q=0` quer dizer **não me mande isto**, e não "tanto faz".
    if (peso <= 0) continue;
    if (base === 'pt') return 'pt';
    if (base === 'en') return 'en';
  }

  return 'en';
}
