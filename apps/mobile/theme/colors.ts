/**
 * Tokens semânticos de cor.
 *
 * Regra: tela e componente NUNCA escrevem hex. Leem daqui. Se falta um valor,
 * ele nasce aqui com nome semântico — não inline.
 *
 * **A paleta é clara primeiro, desde 02/08/2026.** A linha "the palette is
 * dark-first" foi revogada pelo `docs/BRIEFING-NOITE-02-08.md §1`: o dono do
 * produto escolheu clone visual claro do GymRats. O escuro continua completo e
 * coerente, mas é a alternativa, não o alvo — o que se projeta e se revisa é o
 * claro.
 *
 * Os valores do claro foram medidos pixel a pixel em
 * `docs/referencia/gymrats/`: fundo `#F8F8F8`, card `#FFFFFF`, sem sombra e sem
 * borda (o card se separa do fundo só pela diferença de fill de 1,06:1 mais o
 * canto arredondado), metadado em cinza `#919191`. Copiamos a estrutura; o
 * cinza deles não, porque dá 3,15:1 e a nossa regra de metadado legível é
 * 4,5:1 (`MARCA.md §4`).
 *
 * O accent é o azul do coelho desde 2026-07-31, no lugar do lime. Decidido pelo
 * dono do produto junto com os banners de onde o azul foi amostrado; isso
 * supera a linha "lime fica" de docs/DIRECAO-PRODUTO.md.
 */

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  /** App background, behind everything */
  bg: string;
  /** Default card / raised block */
  surface: string;
  /** Card sitting on top of another card */
  surfaceRaised: string;
  /** Pressed / hovered surface */
  surfacePressed: string;

  /** Hairline separators and card outlines */
  border: string;
  /** Stronger outline, for focused or selected states */
  borderStrong: string;

  /** Primary text */
  fg: string;
  /** Secondary text, labels */
  fgMuted: string;
  /** Disabled/non-text detail. Readable timestamps and metadata use `fgMuted`. */
  fgSubtle: string;
  /** Text placed on top of `accent` */
  fgOnAccent: string;

  /**
   * O único accent de marca. Um por tela.
   *
   * **É preenchimento E texto ao mesmo tempo** — FAB, barra de progresso e
   * fundo de botão usam `accent` com `fgOnAccent` em cima; link, ícone de ação
   * e texto de destaque usam `accent` direto sobre `bg`/`surface`. Os dois
   * lados passam em cada modo; ver os números nas paletas abaixo. A tela não
   * escolhe azul: escolhe `accent`.
   */
  accent: string;
  /** Accent em baixa opacidade, para fundo tingido (linha do próprio usuário) */
  accentSoft: string;

  /**
   * Alguém está estudando agora.
   * Rebaixado até a Fase 3 (`MARCA.md §4`) — continua na paleta, sem uso novo.
   */
  live: string;
  liveSoft: string;

  success: string;
  warning: string;
  danger: string;

  /** Product deadline. Calm deadlines stay neutral; use this only for urgency. */
  deadline: string;
  /** Low-emphasis background paired with `deadline`. */
  deadlineSoft: string;

  /** Static loading placeholder. */
  skeleton: string;

  /**
   * @deprecated Pódio aposentado por decisão de produto (`MARCA.md §4` e §3.6):
   * num grupo de 8 com prazo, posição é tipografia — `1º` — não ornamento.
   * Continuam na interface só para não quebrar `LeaderboardPodium.tsx` e os
   * consumidores de `legacyColors`. Nada novo os usa; quem migrar uma tela que
   * os lê, remove o uso em vez de repintar.
   */
  gold: string;
  /** @deprecated ver `gold` */
  silver: string;
  /** @deprecated ver `gold` */
  bronze: string;

  /**
   * Véu sobre foto e atrás de modal.
   *
   * **Mesmo alpha nos dois modos, de propósito.** A função do scrim é fabricar
   * um chão previsível para o texto que vem em cima; se o alpha variasse por
   * tema, o primeiro plano não poderia ser fixo e o par abaixo não existiria.
   * E, mais concreto: uma foto não clareia porque o telefone está no modo
   * claro. O chão sob o scrim é o mesmo problema nos dois modos.
   */
  scrim: string;

  /**
   * Texto e ícone em cima de `scrim` — e em cima de qualquer palco escuro
   * fixo, como o `NIGHT_GRADIENT` do login e do level-up.
   *
   * Existe porque `fg` é a cor da superfície do tema, e sobre o scrim não há
   * superfície de tema nenhuma: com o app claro, `fg` (#17171B) sobre o palco
   * quase preto some. Foi exatamente o que aconteceu com o número do level-up.
   *
   * Medido no pior caso concebível — véu de 72% sobre uma foto estourada
   * (#FFFFFF puro): **9,29:1**. Sobre o palco `#0D1220`: 18,68:1.
   */
  fgOnScrim: string;
  /**
   * O segundo nível em cima de `scrim` — dica, legenda, rodapé de palco.
   *
   * Só existe porque o scrim é grosso o bastante (72%) para sobrar espaço para
   * dois primeiros planos legíveis. Abaixo de ~70% de véu não sobra: sobre foto
   * estourada, um véu de 58% deixa até branco a 80% em 4,08:1. Se algum dia
   * alguém afinar o `scrim`, este token morre junto — não é decorativo.
   *
   * Mesmo pior caso: **5,11:1**. Sobre o palco `#0D1220`: 8,43:1. Continua
   * claramente secundário — 2,2× menos contraste que `fgOnScrim` no palco — sem
   * cair abaixo dos 4,5:1 de texto.
   */
  fgOnScrimMuted: string;
}

/**
 * O modo projetado. Medido contra `docs/referencia/gymrats/`.
 *
 * Contrastes (WCAG 2.1, calculados, não estimados) — sobre `surface` #FFFFFF e
 * sobre `bg` #F7F7F9 respectivamente:
 *
 *   fg        #17171B  17,9:1 · 16,7:1
 *   fgMuted   #65656F   5,8:1 ·  5,4:1   (metadado e timestamp legíveis)
 *   fgSubtle  #83838C   3,7:1 ·  3,5:1   (só detalhe desabilitado / não textual)
 *   accent    #0043BA   8,4:1 ·  7,8:1   como texto; branco em cima dele: 8,4:1
 *   success   #137A38   5,4:1 ·  5,1:1
 *   warning   #A55200   5,5:1 ·  5,2:1
 *   danger    #C81E1E   5,7:1 ·  5,4:1
 *   deadline  #A84C08   5,7:1 ·  5,3:1   e 4,9:1 dentro do próprio pill
 *
 * Sobre os dois azuis, porque essa é a pergunta que a tela não pode ter que
 * responder: a azure clara `#4C9AFF` (BRAND_BLUE) **não entra no claro** — como
 * texto dá 2,9:1 e com texto branco em cima dá os mesmos 2,9:1, então ela falha
 * nos dois papéis. Quem faz os dois papéis aqui é `#0043BA`, que é o traço do
 * line art do coelho: 8,4:1 como texto sobre branco e 8,4:1 com branco em cima
 * como preenchimento. Um token, dois usos, nenhum falha. A azure clara fica
 * viva no escuro e em ilustração/marca, onde nada de texto se apoia nela.
 *
 * O GymRats faz o mesmo desdobramento com o vermelho deles: FAB `#D33A2C`
 * (4,8:1 com o `+` branco) e link "Invite" `#C12414` (5,6:1 como texto). Duas
 * intensidades para dois papéis. Nós resolvemos com uma só porque um azul
 * escuro atende os dois — o vermelho deles não atendia.
 */
const light: Palette = {
  // Medido: o fundo deles é #F8F8F8 e o card é branco puro. Mantemos a mesma
  // distância (1,07:1) e o mesmo desvio frio do escuro (#0A0A0C).
  bg: '#F7F7F9',
  surface: '#FFFFFF',
  // No claro o branco é o teto: o terceiro nível desce de luminância em vez de
  // subir. O nome continua `surfaceRaised` de propósito — renomear seria uma
  // segunda migração no meio da que já está rodando. Dívida com nome.
  surfaceRaised: '#F1F1F5',
  surfacePressed: '#E9E9EF',

  // Hairline decorativa (1,25:1 sobre branco), no espírito da referência — lá o
  // separador dentro do card é quase invisível e o pill "45 min" não tem traço
  // nenhum: é fill branco sobre #F8F8F8. Quando a borda for a ÚNICA coisa que
  // identifica um controle (foco, seleção), use `borderStrong`: 3,15:1, que é o
  // mínimo do WCAG 1.4.11.
  border: 'rgba(10,10,12,0.10)',
  borderStrong: 'rgba(10,10,12,0.45)',

  fg: '#17171B',
  fgMuted: '#65656F',
  fgSubtle: '#83838C',
  // Branco, não near-black: sobre o accent #0043BA o near-black dava 2,1:1 e
  // reprovava todo botão primário do app. Era bug, não escolha.
  fgOnAccent: '#FFFFFF',

  accent: '#0043BA',
  // A azure de marca a 20% sobre o fundo — é o único lugar do claro onde o azul
  // do coelho aparece em fill, e aparece porque nada de texto pequeno depende
  // dele: `fg` em cima dá 14,8:1 e `accent` em cima dá 6,9:1.
  accentSoft: 'rgba(76,154,255,0.20)',

  // No claro não sobra espaço para dois vermelhos ao mesmo tempo legíveis e
  // distinguíveis; enquanto `live` está em espera, ele empresta o vermelho de
  // `danger`. A Fase 3 dá matiz própria a ele quando presença ao vivo voltar.
  live: '#C81E1E',
  liveSoft: 'rgba(200,30,30,0.10)',

  success: '#137A38',
  warning: '#A55200',
  danger: '#C81E1E',

  // Valor fechado na entrega 2 (`MARCA.md §4`) e mantido. O que mudou foi o
  // alpha do soft: 14% → 10%, porque com o fundo novo (#F7F7F9, mais escuro que
  // o #FAFAFB anterior) o pill sobre `bg` caía para 4,35:1. A 10% dá 4,9:1
  // sobre `surface` e 4,6:1 sobre `bg` — passa nos dois chãos.
  deadline: '#A84C08',
  deadlineSoft: 'rgba(168,76,8,0.10)',

  skeleton: '#E6E6ED',

  gold: '#E5A100',
  silver: '#8E8E9A',
  bronze: '#A56A34',

  // Engrossado de 45% para 72% em 02/08/2026, igualando o escuro. A 45%, texto
  // branco sobre uma foto clara dava 3,36:1 — reprovava. A 72% dá 9,29:1 no
  // pior caso possível (foto estourada, #FFFFFF puro). De quebra, o backdrop de
  // modal no claro melhorou: a folha branca sobre o véu passou de 3,54:1 para
  // 9,58:1 de separação contra a página.
  scrim: 'rgba(0,0,0,0.72)',
  fgOnScrim: '#FFFFFF',
  fgOnScrimMuted: 'rgba(255,255,255,0.66)',
};

/**
 * A alternativa. Continua completa e coerente — quem estuda de madrugada troca
 * no perfil — mas deixou de ser o modo contra o qual se desenha.
 *
 * Valores intactos desde a auditoria de 31/07 (accent 6,95:1 sobre `bg`,
 * near-black em cima do accent 6,95:1, pill de `deadline` 6,17:1). Não mexer
 * sem refazer as contas.
 */
const dark: Palette = {
  bg: '#0A0A0C',
  surface: '#131318',
  surfaceRaised: '#1C1C23',
  surfacePressed: '#22222B',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  fg: '#F5F5F7',
  fgMuted: '#8E8E9A',
  fgSubtle: '#686874',
  fgOnAccent: '#0A0A0C',

  // Sampled from the rabbit banners (their fills run #4495F3–#549FF4).
  // 6.95:1 against `bg` — above WCAG AAA for text, so it still carries
  // buttons and live states without a second variant.
  accent: '#4C9AFF',
  accentSoft: 'rgba(76,154,255,0.14)',

  live: '#FF4D4D',
  liveSoft: 'rgba(255,77,77,0.16)',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF5A5A',

  deadline: '#FF8C3B',
  deadlineSoft: 'rgba(255,140,59,0.16)',

  skeleton: '#22222B',

  gold: '#FFC94D',
  silver: '#C4C4CE',
  bronze: '#D08B4F',

  // Idênticos aos do claro — ver a nota em `scrim` na interface.
  scrim: 'rgba(0,0,0,0.72)',
  fgOnScrim: '#FFFFFF',
  fgOnScrimMuted: 'rgba(255,255,255,0.66)',
};

export const palettes: Record<ThemeMode, Palette> = { light, dark };

/**
 * A azure de marca, amostrada do coelho.
 *
 * É o `accent` do escuro e é o azul de ilustração, splash e ícone nos dois
 * modos. **No claro ela não pinta texto nem recebe texto branco em cima**
 * (2,9:1 nos dois sentidos) — ali quem trabalha é `c.accent` `#0043BA`. Use
 * esta constante só onde nenhum texto se apoia na cor.
 */
export const BRAND_BLUE = '#4C9AFF';

/**
 * Céu noturno atrás do login. Só as paradas intermediárias — as pontas vêm da
 * paleta, para o gradiente sempre encontrar o app que ele abre.
 *
 * O login segue escuro de propósito mesmo com o app claro: é tela de marca, não
 * de conteúdo, e é onde a azure `#4C9AFF` tem o fundo que ela precisa.
 */
export const NIGHT_GRADIENT = ['#0D1220', '#121A2C', '#182540'] as const;
