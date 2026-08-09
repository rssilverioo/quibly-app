/**
 * O mapa de constância — a assinatura da página.
 *
 * ## Por que ele é o herói, e não um número grande
 *
 * É o artefato mais nosso que existe. O produto mede **dias em que você
 * apareceu**, e este é o desenho exato disso: uma célula por dia, sete linhas
 * porque a semana tem sete. Ele já está no app, no perfil de todo mundo.
 *
 * Um número grande com rótulo pequeno diria a mesma coisa e não seria de
 * ninguém. Este grid não funciona para outro produto.
 *
 * ## Por que ele preenche, em vez de aparecer pronto
 *
 * Porque constância é uma coisa que acontece no tempo, e o preenchimento é a
 * única forma de dizer isso sem escrever. Cada célula entra na ordem em que o
 * dia aconteceu — e a última fica pulsando, porque hoje ainda não terminou.
 *
 * ## Por que a animação é só CSS
 *
 * A primeira versão preenchia via `IntersectionObserver`, com as células
 * começando em `opacity: 0`. Num navegador sem JS — ou num headless tirando o
 * print para as redes sociais — o observador nunca disparava e **o mapa não
 * aparecia**, deixando um buraco no meio do herói.
 *
 * Em CSS puro, `animation-fill-mode: backwards` faz a célula ficar invisível
 * durante o próprio atraso e aparecer quando chega a vez dela. Sem JS, a
 * animação simplesmente não roda e o mapa está lá, cheio. A informação nunca
 * depende do movimento.
 *
 * `prefers-reduced-motion` desliga a animação pela mesma porta, no CSS.
 */

const SEMANAS = 24;
const DIAS = 7;

/**
 * A intensidade de cada dia, de 0 (nada) a 4 (muito).
 *
 * Gerado por uma função determinística, e não por `Math.random()`: com sorteio,
 * o servidor desenha um mapa e o cliente desenha outro, e o React reclama de
 * hidratação. Também garante que a página é sempre a mesma — um material de
 * marketing que muda de forma a cada visita é um material que ninguém
 * reconhece.
 *
 * A curva sobe ao longo do tempo de propósito: é a história que o produto conta
 * — alguém que começa irregular e vira constante.
 */
function intensidade(semana: number, dia: number): number {
  const progresso = semana / SEMANAS;
  const ruido = ((semana * 7 + dia * 13) % 11) / 11;
  const chance = 0.15 + progresso * 0.75;
  if (ruido > chance) return 0;
  return 1 + Math.floor(ruido * 4 * progresso) % 4;
}

const TONS = [
  'var(--celula-vazia)',
  'rgba(1,95,253,0.28)',
  'rgba(1,95,253,0.52)',
  'rgba(1,95,253,0.76)',
  'var(--marca)',
];

export default function MapaDeConstancia() {
  return (
    <div className="mapa" role="img" aria-label="Mapa de dias de estudo ao longo de seis meses">
      {Array.from({ length: SEMANAS }).map((_, semana) => (
        <div key={semana} className="mapa-semana">
          {Array.from({ length: DIAS }).map((_, dia) => {
            const nivel = intensidade(semana, dia);
            const ultima = semana === SEMANAS - 1 && dia === DIAS - 1;
            return (
              <span
                key={dia}
                className={`mapa-celula${ultima ? ' mapa-hoje' : ''}`}
                style={{
                  background: nivel === 0 ? TONS[0] : TONS[nivel],
                  animationDelay: `${(semana * DIAS + dia) * 5}ms`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
