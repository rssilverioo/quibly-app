# Design — o clone claro do GymRats, tela a tela

> Escrito em 2026-08-02 pelo Design Lead. Executa `BRIEFING-NOITE-02-08.md`.
> **Este documento é o que se implementa esta noite.** Onde ele discorda de
> `MARCA.md`, `DIRECAO-PRODUTO.md` ou `FLUXO-TELAS-APP.md`, a discordância está
> escrita e argumentada na §3 — não há divergência silenciosa.
>
> Escrito para quem abre o arquivo às 3 da manhã e precisa de um número.
> Se você encontrar um adjetivo onde deveria haver um número, é defeito meu:
> reporte ao CEO, não adivinhe.

---

## 0. Como ler este documento

- **Todo número está em `pt`** (pontos lógicos do React Native), não px de imagem.
  Aparelho de projeto: **393pt de largura × 852pt de altura** (iPhone 15/16 Pro).
- **Nenhum hex.** Cor é sempre um nome de `theme/colors.ts` lido por `useTheme()`.
- **Nenhum tamanho de fonte solto.** Sempre um degrau de `text` em
  `theme/tokens.ts`. Se você precisou de um tamanho que não existe, a tela está
  errada, não a escala — e a §4.3 lista os dois casos em que eu verifiquei isso.
- **`REF:`** marca um número que eu medi na referência do GymRats.
  **`INFERIDO:`** marca um número que eu decidi sem referência. Os dois estão
  separados de propósito: suposição vendida como observação é o pior defeito
  possível num spec.

---

## 1. O que eu vi, e o que eu NÃO consegui ver

Modelo de honestidade herdado de `MARCA.md §1.1`.

### 1.1 Vi, e medi

As sete imagens de `docs/referencia/`, abertas e medidas pixel a pixel:

| Arquivo | O que é |
|---|---|
| `gymrats/real-play-store-feed.png` | app real rodando (Android, Play Store) |
| `gymrats/gr-en-14-challenge.png` | feed do desafio (900×1948) |
| `gymrats/gr-en-14-workout.png` | detalhe do post |
| `gymrats/gr-en-14-team-up.png` | tela de time |
| `gymrats/gr-en-14-be-accountable.png` | placar + estatísticas de grupo |
| `gymrats/gr-en-14-stay-motivated.png` | chat |
| `gymrats/gr-icon.png` | ícone (rato branco chapado sobre gradiente vermelho) |
| `mascote-coelho-referencia.png` | nosso coelho — 9 estados, silhueta branca sobre azul |

Mais duas capturas do **nosso** app rodando, tiradas hoje:
`referencia/estado-atual/01-lista-de-salas-ANTES-dark.png` e
`-DEPOIS-claro.png`.

E o código: as 15 telas, `theme/tokens.ts`, `theme/colors.ts`, `theme/index.ts`,
`components/feed/*`, `components/mascot/*`, `lib/feed-row-structure.test.ts`.

### 1.2 Como os números foram calibrados

Isto importa porque um mockup de aparelho escala a captura, e medir em px da
imagem sem âncora produz números falsos com cara de precisos.

A escala das cinco imagens da App Store foi fixada em **1,6463 px de imagem por
pt**, confirmada por três âncoras independentes na mesma imagem:

| Âncora | Tamanho real conhecido | Medido | Escala |
|---|---|---|---|
| Home indicator | 139pt | 228px | 1,640 |
| Dynamic Island | 36,67pt de altura | 59px | 1,609 |
| Relógio da status bar (SF Pro 17pt) | cap-height 11,9pt | 20px | 1,681 |
| Largura da tela | 393pt | 647px | 1,646 |

Média 1,646, dispersão ±1%. Isso confirma também que o **aparelho da referência
tem 393pt de largura** — se fosse o 6,9" de 440pt, o home indicator mediria
204px e não 228.

Tamanhos de fonte foram derivados de cap-height medido ÷ 0,705 (a razão
cap-height/em de uma geométrica arredondada tipo Nunito). Isso tem erro de ±1pt.
Onde o erro importa, eu digo.

### 1.3 NÃO consegui ver, e não estou preenchendo com suposição

- **O modo escuro do GymRats.** Todo material que existe é claro. Isso deixou de
  ser problema hoje — o briefing decidiu claro — mas continua sendo verdade que
  **nesta dimensão não há referência**, e por isso todo número do escuro neste
  documento é derivação do claro, não observação.
- **Micro-interação, transição, movimento, som, háptico.** Captura não conta
  nada disso. Onde eu especifico movimento, é `INFERIDO:`.
- **A fonte exata deles.** Geométrica arredondada (família Nunito/Quicksand),
  não confirmada. Não copiamos a fonte: usamos `FONTS` de `@quibly/shared`.
- **Telas que a referência não tem.** GymRats não tem timer, não tem onboarding
  de estudo, não tem login capturado, não tem tela de publicar foto isolada, não
  tem perfil capturado. Nas seções §5.6, §5.7, §5.9, §5.10, §5.12, §5.13, §5.14
  e §5.15 **não existe referência** — os números vêm da disciplina medida nas
  seis telas que existem, aplicada por analogia. Está marcado em cada uma.
- **Estados de erro e de vazio deles.** Nenhuma captura mostra um. Todo estado
  vazio e de erro deste documento é `INFERIDO:`.
- **O peso exato das fontes deles.** Distingo "bold" de "regular" a olho no
  desenho da haste; não medi densidade de traço. Onde eu digo o peso, é leitura
  visual, não medição.

---

## 2. A referência, medida

Números que valem para **todas** as telas. Estão aqui uma vez para não se
repetirem quinze.

### 2.1 Grade e superfícies

| O quê | REF (medido) | Nosso valor | Token |
|---|---|---|---|
| Margem lateral | 17,6pt | **16** | `space.lg` |
| Cor da página | `#F8F8F8` | `#F7F7F9` | `c.bg` |
| Cor do card | `#FFFFFF` | `#FFFFFF` | `c.surface` |
| Raio do card | 6–7pt | **8** | `radius.sm` |
| Raio de pill | total | **999** | `radius.full` |
| Altura da tab bar | 83pt (49 + 34 de inset) | 83 | — |

**A referência não usa sombra em card nenhum.** A separação é só luminância:
248 contra 255. Ver §3.2.4 — no nosso claro isso não basta sozinho.

### 2.2 Tipografia, medida contra a nossa escala

| Elemento na referência | REF (nominal) | Degrau nosso | Delta |
|---|---|---|---|
| Título de tela ("Be-leaf in your roots") | ~23pt bold | `text.title2` (28) | +5 |
| Título de seção ("Rankings", "Group stats") | ~16pt bold | `text.bodyStrong` (16) | 0 |
| Nome na linha do placar | ~15pt regular | `text.bodyStrong` (16) | +1 |
| Título da linha do feed | ~14pt regular | `text.bodyStrong` (16) | +2 |
| Texto de pill (`⏱ 45 min`) | ~14pt | `text.label` (14) | 0 |
| Sublinha ("3 days active") | ~12pt | `text.caption` (12) | 0 |
| Separador de dia ("Yesterday") | ~12pt | `text.caption` (12) | 0 |
| Hora à direita ("7:41 pm") | ~11pt | `text.caption` (12) | +1 |
| Numeral de posição ("**2**nd") | ~19–20pt bold | `text.title3` (20) | 0 |
| Sufixo ordinal ("nd") | ~14pt | `text.label` (14) | 0 |
| Valor da faixa de 3 colunas ("29") | ~14pt | `text.bodyStrong` (16) | +2 |
| Rótulo da faixa ("days left") | ~12pt | `text.caption` (12) | 0 |

**Dois pesos, e só dois: `semiBold`/`bold` e `regular`/`medium`.** A referência
não tem um terceiro.

**Nenhum número grande em lugar nenhum.** O maior número da referência inteira é
o numeral de posição, 20pt. Consequência dura para nós: **`text.display` (64) e
`text.title1` (40) não aparecem em nenhuma tela de sala.** Ver §3.2.1.

### 2.3 Onde a referência gasta cor

Três lugares, e mais nada:

1. O FAB `+`
2. Os links de ação ("Invite", "Add member", "All rankings")
3. A barra de progresso do desafio

Tudo o resto é preto sobre branco e cinza sobre branco. **A cor da tela são as
fotos das pessoas.** Aqui esses três lugares usam `c.accent` — no claro
`#0043BA`, no escuro `#4C9AFF`. O vermelho deles não entra em lugar nenhum.

---

## 3. As decisões que eu tive que tomar

### 3.1 A foto no feed — a contradição, fechada

**O problema.** `MARCA.md §3.1` retirou publicamente a proposta de linha
compacta e fixou o card cheio com foto grande no feed, com um argumento bom:
*"no GymRats a foto ilustra um título; na nossa, a foto é a prova. Prova em
miniatura de 56px não é prova publicada, é prova arquivada."* O código foi para
o outro lado: `app/league/room/[id].tsx` renderiza `components/feed/FeedRow.tsx`,
a linha compacta. Nem o doc nem o código registram que isso aconteceu.

**Decisão: a linha compacta fica. O card cheio não volta para o feed.**

Cinco razões, em ordem de peso:

1. **`PLANO-FECHAMENTO.md §Etapa 2` já decidiu, e é a etapa "a única que
   importa".** A tabela de entregas lista literalmente *"Linha compacta com
   miniatura — thumbnail, título, autor e hora, como na referência"*. Não é uma
   pergunta aberta; é uma entrega escrita pelo dono do plano.
2. **A geometria já é aprovada pelo dono e travada por teste.**
   `lib/feed-row-structure.test.ts` diz `keeps the owner-approved 72/56/18
   geometry`. Reabrir custa uma decisão do dono, uma reescrita de teste e o
   terceiro giro da mesma decisão.
3. **A referência resolve o empate, e o briefing §2 diz que ela resolve.**
   `real-play-store-feed.png` é o app real: linha compacta com miniatura
   circular. "O mais parecido possível" tem um lado só aqui.
4. **O argumento de `MARCA §3.1` está certo e é atendido — só que uma camada
   abaixo.** A prova *é* publicada grande: no detalhe do post ela ocupa
   **468pt de altura**, 55% da tela (`REF:` §5.2). Esse caminho já existe e é
   alcançável de qualquer linha do feed
   (`FeedRow → /league/feed/post/[id] → PostCard`). A prova não fica arquivada:
   fica a um toque, e no toque ela toma a tela inteira. O que se perde é ver a
   prova *sem pedir*; o que se ganha é ver **quem apareceu hoje** de uma passada.
5. **Densidade é o argumento que `MARCA §3.1` errou.** Ele diz que "um grupo de
   5–20 pessoas gera 4–8 posts por dia, não há o que rolar". Verdade para *um
   dia*. O feed da sala não é de um dia: é o registro do desafio, 7 a 30 dias.
   Numa tela de 852pt a referência mostra **4 linhas + o hero inteiro + 3
   separadores de dia**. Com card cheio de foto 4:3 cabem 1,5 posts. A pergunta
   que a sala responde ("quem apareceu, e quando") é uma chamada de presença,
   não uma revista.

**A arquitetura que isso fecha — duas superfícies, uma para cada pergunta:**

| Superfície | Componente | A foto | A pergunta que responde |
|---|---|---|---|
| Feed da sala | `FeedRow` (linha compacta, 72pt) | miniatura 56 | *quem apareceu, e quando* |
| Detalhe do post | `PostCard` (card cheio) | **55% da tela** | *o que a pessoa fez* |

**Isso é o padrão da própria referência**, não um meio-termo:
`real-play-store-feed.png` é a lista compacta e `gr-en-14-workout.png` é a foto
grande. Os dois convivem por desenho. O que `MARCA §3.1` decidiu foi só a
primeira linha da tabela, e é só essa linha que este documento inverte.

**Custo real da decisão contrária, para quem quiser reabrir:** não é ressuscitar
código. `PostCard.tsx` está vivo e mantido de qualquer jeito (§3.4). O custo é
reverter uma geometria aprovada pelo dono e travada por teste, reescrever o
`FlatList` do feed com separadores de dia entre cards altos, e girar a mesma
decisão pela terceira vez em três dias. Não vale.

**O que a decisão obriga, e é entrega desta noite:** a linha compacta de hoje
**não é** a linha da referência. Hoje ela é uma faixa nua sobre o fundo da página, sem
superfície. Na referência **cada linha é um card branco de 70pt com raio, com
10,9pt de respiro entre linhas do mesmo dia**. Isso é o que muda. Ver §5.1.

**Divergência registrada, de propósito:** a miniatura da referência é um
**círculo de 48,6pt**. A nossa continua **quadrado arredondado de 56pt**
(`radius.sm`). A razão está no comentário do próprio `FeedRow.tsx` e é a razão
certa: um círculo recorta ~21% de uma foto quadrada, e a foto é o produto. Não
"conserte" isso; está decidido.

### 3.2 Light-first: onde `MARCA.md` depende de fundo escuro

`MARCA.md` foi escrito assumindo dark. Eu não reescrevo `MARCA.md` — cito a
seção e digo o que muda.

#### 3.2.1 `MARCA §3.2` e a escala grande — o defeito mais visível hoje

`MARCA` diz "o card não usa `text.display` nem `text.title1`". Correto, e
insuficiente: **as telas usam `text.title1` (40pt) no título da tela.**
`app/(tabs)/index.tsx:title`, `app/league/room/[id].tsx:title` e
`app/league/details/[id].tsx:title` todos usam `text.title1`. A captura de hoje
mostra "Your rooms" ocupando 40pt de altura contra **~23pt medidos na
referência** — quase o dobro.

**Correção, e vale para as 15 telas: título de tela é `text.title2` (28).**
`text.title1` fica restrito ao número do timer rodando e ao level-up.
`text.display` sai do app inteiro.

Por que 28 e não um degrau novo de 24: 5pt de diferença num título alinhado à
esquerda não muda hierarquia — hierarquia vem de posição e exclusão (§2.2) — e
um degrau a mais é uma decisão a mais em toda tela futura. **A escala não ganha
degrau.**

#### 3.2.2 `MARCA §3.2` bloco 3 — o ponto da matéria `RESOLVIDO DURANTE A NOITE`

**O que eu encontrei:** `SUBJECT_COLORS` estava afinada para fundo escuro
(`#C8FF4D`, `#4ADE80`, `#FBBF24`…). `#C8FF4D` sobre `#FFFFFF` dá cerca de 1,2:1 —
um ponto de 8px nessa cor **não existe** no claro. `MARCA` já proíbe colorir o
texto com ela, mas assume que o ponto funciona.

**O que aconteceu enquanto eu escrevia:** o Tech Lead reafinou a lista para o
claro (`#5F8310`, `#198942`, `#1680AF`, `#815EEB`, `#E21C83`, `#B96017`,
`#977213`, `#1B8678`, `#E52C2C`, `#5D6AEB`). No claro o problema acabou.

**O que fica como pedido de verificação, e não é meu escopo confirmar:** a
mesma reafinação empurra o risco para o **escuro**. `#5F8310` sobre `#0A0A0C`
fica na faixa de 3:1 — que é o mínimo para elemento não textual, sem folga.
**Peça ao Eng. de Verificação uma leitura dos dez pontos sobre `dark.bg`.**
Não invente uma segunda lista de cores para resolver isso sem medir antes.

**Para o dev de tela, a instrução não muda:** ponto de 8×8, `radius.full`, na
cor da matéria. **Ela nunca colore o texto** — só o ponto.

#### 3.2.3 `MARCA §3` inteiro fala em "lime" — o accent não é mais lime

O accent é `#4C9AFF` no escuro e `#0043BA` no claro, amostrado do coelho
(`colors.ts`, briefing §1). **Onde `MARCA §3.2`, `§3.5`, `§3.6` e `§4` dizem
"lime", leia `c.accent`.** As regras que eles carregam continuam valendo
palavra por palavra: o accent não entra no card do post; fica para o FAB, o
prazo apertando e a linha do próprio usuário no placar.

#### 3.2.4 `c.bg` claro está perto demais de `c.surface`

**O que eu encontrei:** `bg #FAFAFB` (250) contra `surface #FFFFFF` (255) —
**5 níveis**. A referência usa 248 contra 255 (7 níveis) e mesmo assim só
funciona porque os cards são grandes. Na captura clara de hoje
(`estado-atual/01-lista-de-salas-DEPOIS-claro.png`) não há aresta nenhuma
visível entre página e conteúdo.

**Resolvido durante a noite:** o Tech Lead baixou `light.bg` para `#F7F7F9`
(8 níveis, praticamente a referência) e subiu `light.border` para
`rgba(10,10,12,0.10)`. O pedido que eu ia fazer já está feito.

**A regra que fica, e é permanente:** todo card leva `borderWidth: 1` em
`c.border`. No claro ela desenha a aresta; no escuro
(`rgba(255,255,255,0.08)`) ela some. **A mesma linha de código serve os dois
modos** — não escreva a borda condicionada ao `mode`.

#### 3.2.5 `MARCA §3.5` — a barra de progresso de "4–6px" contra os 18pt medidos

`MARCA §3.5` especifica barra de 4–6px. Medi **18,2pt de altura, pill, largura
total** na tela de detalhes (`gr-en-14-be-accountable.png`).

**Resolução, dois números, cada um com razão:**

- **Card do desafio no feed: 6pt.** `MARCA` está certo aqui — o card responde três
  perguntas em uma passada, e uma barra de 18pt vira o elemento mais forte de um
  card que tem quatro blocos.
- **Tela do placar/details: 18pt, `radius.full`.** Lá a barra é o segundo
  elemento da tela, logo abaixo do título, e é o único lugar do app onde o
  accent tem permissão de ocupar *área*. Trilho `c.surfacePressed`, preenchimento
  `c.accent`. Hoje `details/[id].tsx` usa 8pt — sobe para 18.

#### 3.2.6 `MARCA §5.1` — as capas dependem de fundo escuro

`MARCA §5.1` fecha a capa como "silhueta lime sobre fundo dark-first". Superado
duas vezes: a arte é o coelho (não o castelo), e o traço é azul sobre branco. Na
captura de hoje no claro, **a faixa da capa não tem aresta**: a arte flutua sobre
a página porque `#FFFFFF` da arte encosta em `#FAFAFB` do fundo.

**Correção:** capa e miniatura de capa recebem `borderWidth: 1` em `c.border`
(mesma regra da §3.2.4). Sem isso a ilustração parece um recorte solto.

#### 3.2.7 `MARCA §5` — o mascote do repositório ainda é o castelo

`MARCA §5` argumenta pelo castelo. Revogado: o mascote é o coelho (briefing §1,
commit `8721a4c`), e `PLANO-FECHAMENTO §Etapa 3` já lista *"coelho branco
substituindo o castelo em todas as superfícies"*.

Isso ainda **não** aconteceu no código: `components/mascot/Mascot.tsx` desenha um
castelo de tijolo marrom (linhas ~190–240), e `components/brand/CastleMark.tsx`
desenha um castelo azul. Os dois estão em tela hoje.

**A regra de `MARCA §5` — mascote não entra em card de post nem em placar —
continua de pé, com uma exceção nomeada.** Ver §3.3.

### 3.3 O coelho — onde entra, e em que tamanho

**Regra de superfície.** No claro o coelho é **traço `c.accent` sobre `c.surface`
ou sobre `c.accentSoft`** — é o tratamento das capas que já rodam. No escuro,
inverte: silhueta clara sobre `c.bg`. A silhueta branca sobre campo azul cheio
(o arquivo `mascote-coelho-referencia.png`) fica reservada para **o ícone do app
e nada mais**.

> ⚠️ Armadilha que vai acontecer se ninguém ler isto: `FeedRow.tsx` chama
> `<Mascot ... plate={false} />` dentro de um tile `c.surfaceRaised`. No claro,
> `surfaceRaised` é `#FFFFFF`. Hoje aparece porque o mascote é um castelo
> marrom. **No dia em que o castelo virar o coelho branco, esse tile fica em
> branco sobre branco.** A regra abaixo é o conserto.

**Onde ele entra, e o tamanho — lista fechada:**

| Tela / lugar | Estado | Tamanho | Fundo |
|---|---|---|---|
| Home vazia (`(tabs)/index`) | `wave` | **150** | `c.bg` |
| Onboarding, um por passo | ver §5.14 | **132** | `c.bg` |
| Fim de desafio / vencedor | `trophy` | **132** | `c.bg` |
| Feed da sala vazio | `reading` | **120** | `c.bg` |
| Paywall (`pricing`) | `star` | **120** | `c.bg` |
| Erro de carregamento (qualquer tela) | `worried` | **96** | `c.bg` |
| Login | `idle` | **96** | gradiente |
| **Miniatura de post sem foto** | `idle` | **34** | tile `c.accentSoft` |

Nada de outros tamanhos. Oito números, e a lista acima é a lista inteira.

**A exceção, e por que ela é exceção e não furo.** A miniatura de 34pt no tile de
56pt do feed é o **único** lugar onde o mascote toca uma superfície de post.
`MARCA §5` proíbe mascote em superfície de dado porque ali "quem manda é a foto
da pessoa e o dado". Aqui **não há foto** — o mascote *é* a ausência da foto,
não um enfeite sobre o dado. A alternativa é o retângulo cinza que
`PLANO-FECHAMENTO §Etapa 2` nomeia como o defeito com nome e endereço. Registro
como **emenda a `MARCA §5`**, e ela está travada por teste
(`feed-row-structure.test.ts`).

**Onde ele NÃO entra, e isto é entrega de remoção:**

- **Linha do placar.** `app/league/challenge/[id].tsx` renderiza
  `<CastleMark size={26} />` no lugar da miniatura quando não há foto. Isso é
  mascote em placar — proibido por `MARCA §5` e por `DIRECAO-PRODUTO §7` — e é o
  mascote errado. **Sai.** Substituto: o tile fica `c.surfaceRaised` liso, sem
  glifo nenhum (a foto da pessoa está no avatar ao lado; um segundo símbolo ali
  é ruído).
- Card do desafio, chat, detalhe do post, placar, qualquer tela de dado.

### 3.4 O que morre — entrega, não descoberta às 3 da manhã

Levantado com o CEO e verificado por mim (`grep` de `router.push`/`replace` e de
`import` em `app/` e `components/`).

| Arquivo | Linhas | Por quê | Confiança |
|---|---|---|---|
| `app/league/[id].tsx` | 952 | declarada em `_layout` mas **nenhuma rota aponta para `/league/<id>`** | confirmado |
| `app/league/feed/[id].tsx` | 167 | mesmo caso | confirmado |
| `components/LeagueFeedTab.tsx` | 134 | único consumidor é `league/[id].tsx` | confirmado ×2 |
| `components/LeaderboardPodium.tsx` | 195 | único consumidor é `league/[id].tsx`; e `MARCA §3.6`/`§4` já aposentaram o pódio — **doc e código concordam** | confirmado ×2 |
| `components/brand/CastleMark.tsx` | 16 | §3.3 — mascote errado, em placar | confirmado |
| `app/league/index.tsx` | 144 | alcançada só por `app/(tabs)/profile.tsx:254` ("Minhas Ligas"); `FLUXO §10` já a mata. Contém link morto para `/league/join` sem código | **suspeita** — remover a linha do perfil primeiro, depois o arquivo |

> **O que NÃO está morto, verificado por dois levantamentos independentes (o
> meu e o do CEO) que chegaram ao mesmo lugar:**
> **`components/feed/PostCard.tsx` está vivo.** Dois consumidores, os dois
> alcançáveis: `app/league/feed/post/[id].tsx:9` (detalhe do post, aberto de
> `app/league/room/[id].tsx:124`) e
> `app/league/challenge/[id]/member/[userId].tsx:8` (aberto de
> `app/league/challenge/[id].tsx:67`). É o card do **detalhe**, é mantido de
> qualquer jeito, e a §5.2 é o spec dele. **Não apague.**
>
> Corroboração no próprio código: `app/league/details/[id].tsx:42` já traz um
> comentário reconhecendo `league/[id]` como legado e explicando que a ação de
> sair migrou para lá porque aquela tela não é mais navegada.

**Dívida de cor, para quem for tocar em tela legada.** O grosso não é hex na mão
— são `staticDark`, `legacyColors` e `const COLORS` em 28 arquivos. Os únicos hex
de verdade estão em `app/(auth)/login.tsx` (9) e
`components/auth/GoogleSignInButton.tsx` (7). Os de `components/mascot/parts.tsx`
(40) e `Mascot.tsx` (20) são ilustração e são legítimos.

---

## 4. Fundação — vale para as 15 telas

### 4.1 Anatomia vertical padrão

```
0 ─────────────────────────  topo da tela
     status bar (54pt, do sistema)
54 ────────────────────────
     barra de navegação: 44pt de altura, ícone 22pt em c.fg,
     alvo de toque 44×44, margem lateral 16
98 ────────────────────────
     título da tela: text.title2 (28/38) / c.fg, alinhado à esquerda,
     margem lateral 16, 12pt de respiro abaixo
     REF: cap-top a 96,7pt, baseline a 114,6pt do topo da tela
140 ───────────────────────
     conteúdo
     ...
769 ───────────────────────
     tab bar: 83pt (49 + 34 de inset)
852 ───────────────────────
```

`REF:` a referência abre a tela com o título já visível abaixo da barra de
ícones — **não** com título grande em `largeTitle` de iOS, e **não** centralizado.

### 4.2 O card padrão

```
backgroundColor: c.surface
borderRadius:    radius.sm      (8)   ← REF: 6–7pt
borderWidth:     1
borderColor:     c.border
```

Sem sombra. Sem `surfaceRaised` como fundo de card — `surfaceRaised` no claro é
`#FFFFFF`, idêntico a `surface`, e usá-lo como "card sobre card" no claro não
produz nenhuma diferença.

### 4.3 Os dois lugares em que eu verifiquei se falta degrau na escala

1. **Título de tela.** Referência ~23pt; a escala pula de 20 (`title3`) para 28
   (`title2`). **Não falta degrau** — ver §3.2.1.
2. **Título da linha compacta.** Referência ~14pt regular; usamos
   `text.bodyStrong` (16 semiBold). **Não falta degrau**: `text.label` (14,
   medium) existe e seria a tradução literal, mas a nossa linha tem 72pt de
   altura (contra 70) e uma miniatura de 56pt (contra 48,6) — proporcionalmente,
   16pt é o título que essa linha pede. Fica `bodyStrong`, e a divergência de
   +2pt está registrada aqui para ninguém "consertar" depois.

**Nenhum degrau novo é pedido.** Se você precisar de um, pare e reporte ao CEO.

### 4.4 Estados — o contrato que vale em toda tela

| Estado | Regra |
|---|---|
| **Carregando** | `ActivityIndicator` em `c.accent`, centralizado. Onde a forma do conteúdo é conhecida e a espera passa de ~300ms, esqueleto em `c.skeleton` em vez do spinner. **Nunca esqueleto para foto** (`MARCA §3.3`). |
| **Vazio** | Coelho no tamanho da §3.3 + título `text.title2`/`c.fg` + uma linha `text.body`/`c.fgMuted` + **uma** ação em `c.accent`. O texto diz o que *produz* conteúdo, não que não há conteúdo. |
| **Erro** | Coelho `worried` 96 + `text.body`/`c.fgMuted` com o que falhou + botão "Tentar de novo" em `c.accent`. **Nunca `Alert.alert` para erro de carregamento** — alerta é para ação destrutiva. |
| **Sem foto** | O bloco de foto **não existe**; nunca moldura vazia, nunca "prova enviada" com ícone de câmera. Na linha compacta, o tile vira coelho 34 sobre `c.accentSoft` (§3.3). |

---

## 5. Tela a tela

---

### 5.1 Feed da sala — `app/league/room/[id].tsx` `A TELA-MÃE`

Referência: `gr-en-14-challenge.png` e `real-play-store-feed.png`.
**Esta é a única tela em que temos a captura do app real rodando.**

#### Blocos, de cima para baixo

| # | Bloco | Altura | Respiro abaixo | REF (do topo da tela) |
|---|---|---|---|---|
| 1 | Barra de navegação (voltar + `⋯`) | 44 | 0 | 57–80pt |
| 2 | Título da sala | 38 (line-height de `title2`) | 12 | cap-top 96,7 / baseline 114,6 |
| 3 | **Capa** | **144** | 0 (colada) | 128,8 → 266,1 = **137,9pt** |
| 4 | **Faixa de três colunas** | **56** | 20 | 266,7 → 319,5 = **52,8pt** |
| 5 | (modo estudo) Faixa "estudando agora" | conteúdo | 12 | sem referência — `INFERIDO:` |
| 6 | Separador de dia | 41 (12 acima / 17 texto / 12 abaixo) | — | **37,7pt** |
| 7 | Linha de post (card) | **72** | **12** entre linhas do mesmo dia | 69,9pt / gap 10,9pt |
| — | FAB | 56, canto inferior direito | 16 acima da tab bar | Ø 54,7 / margem direita 18,2 |
| — | Tab bar da sala (Details/Rankings/Chat) | 66 | — | 83pt |

#### 3 — A capa

- Largura: `393 − 16×2 = 361pt`. **`paddingHorizontal` da lista passa de
  `space.xl` (24) para `space.lg` (16)** — e com isso o truque de
  `marginHorizontal: -space.xl` do `hero` **some inteiro**. A capa deixa de ser
  um caso especial de layout.
- Proporção: `ROOM_COVER_ASPECT_RATIO` = 2,5 (a proporção nativa da arte).
  `REF:` a capa deles mede 2,59:1. Bate.
- Altura resultante: `361 / 2,5 = 144,4pt`. **`maxHeight` cai de 170 para 150** —
  o teto existe só para telas largas e a 170 ele nunca era atingido; a 150 ele
  ainda não é, e passa a proteger de verdade.
- `borderRadius: radius.sm` nos **cantos de cima apenas**; a faixa da §4 fecha os
  de baixo. Capa e faixa são **um card só** — na referência não há costura entre
  os dois.
- `borderWidth: 1` / `c.border` (§3.2.6).
- Fundo enquanto carrega: `c.skeleton`.

#### 4 — A faixa de três colunas `Leader / Você / dias restantes`

Este bloco foi medido com cuidado porque o briefing pediu.

```
altura total 56 = 14 (padding) + 28 (conteúdo) + 14 (padding)
REF: 52,8 = 13,4 + 26,0 + 13,4
```

- `flexDirection: 'row'`, **`justifyContent: 'space-evenly'`**.
  `REF:` os três grupos medem 58,3 / 47,7 / 63,8pt e começam em 66,2 / 168,3 /
  258,2pt. `space-evenly` prevê 64,5 / 169,7 / 264,3 — erro máximo de 6pt. Nem
  `center` por terço nem `space-between` chegam perto.
- Cada coluna: `[avatar ou ícone 28pt] · gap 8 · [coluna de dois textos]`.
  `REF:` avatar 26,7pt, ícone de calendário 21pt. Uso 28 para o avatar
  (`Avatar size={28}`, que é o que o código já faz) e 22 para o ícone.
- Valor: `text.bodyStrong` / `c.fg`. `REF:` ~14pt; nosso degrau é 16.
- Rótulo: `text.caption` / `c.fgMuted`. `REF:` ~12pt. Bate.
- Terceira coluna: ícone `CalendarDays` 22pt em `c.fgMuted`, valor = dias
  restantes, rótulo = "dias restantes".
- **Sem cor nenhuma nesta faixa**, nem no prazo apertando. O prazo em `c.deadline`
  mora no card do desafio quando não há capa (`MARCA §3.5`), não aqui.

#### 6 — Separador de dia

- Texto centralizado, `text.caption` / `c.fgMuted`.
- **Capitalização de frase, não caixa alta.** `REF:` "Today", "Yesterday",
  "Tuesday, Jan 28" — minúsculas. Isto **contraria `MARCA §3.2`**, que pede
  `text.overline` (caixa alta, tracking 1,1). Fico com a referência: caixa alta
  num separador que se repete 3–5 vezes por tela adiciona peso visual onde a
  referência escolheu não ter. Hoje o código usa `text.label` (14) — desce para
  `text.caption` (12).
- Bloco: `paddingTop: 12`, `paddingBottom: 12`, texto com line-height 17 →
  **41pt** (REF 37,7).

#### 7 — A linha de post

**A mudança estrutural da noite.** Hoje `FeedRow` é uma faixa transparente sobre
o fundo da página. Passa a ser **um card**:

```
altura        72                       (travado por teste; REF 69,9)
fundo         c.surface
raio          radius.sm  (8)           REF 6–7
borda         1px c.border
padding-esq   8                        REF 8,5
gap thumb→txt 10                       REF 10,3
padding-dir   16
gap entre linhas do mesmo dia   12     REF 10,9
```

Blocos internos, da esquerda para a direita:

| Bloco | Regra | Token |
|---|---|---|
| Miniatura | 56×56, `radius.sm`. **Quadrado, não círculo** — §3.1 | — |
| Miniatura sem foto | tile 56×56 `radius.sm`, fundo `c.accentSoft`, coelho `idle` 34 | §3.3 |
| Título | 1 linha, `numberOfLines={1}` | `text.bodyStrong` / `c.fg` |
| Byline | avatar 18 + nome, `gap: 5`, `marginTop: 5` | `text.caption` / `c.fgMuted` |
| Hora | direita, alinhada ao eixo do byline | `text.caption` / `c.fgMuted` |

`REF:` na referência a hora fica alinhada com a **segunda** linha (o byline), não
com o título. O código de hoje centraliza verticalmente na linha inteira —
diferença de ~7pt. Ajuste `alignSelf: 'flex-end'` com `paddingBottom` igual ao
padding da linha, ou aceite a diferença: é o item de menor prioridade desta tela.

#### Densidade — o número que fecha a tela

`REF:` numa tela de 852pt a referência mostra **4 linhas de post completas + o
hero inteiro + 3 separadores de dia**, com o FAB e a tab bar por cima.

**A nossa tem que caber o mesmo: 4 linhas.** A conta:

```
852 − 54 status − 44 nav − 38 título − 12 respiro
    − 144 capa − 56 faixa − 20 respiro − 83 tab bar   =  401pt de feed
4 linhas × (72 + 12) = 336  +  2 separadores × 41 = 82   →  418
```

418 contra 401: a quarta linha aparece **parcialmente**, exatamente como na
referência (onde a quarta linha também entra cortada). Se depois de montar
couberem 3, procure o excesso nesta ordem: título em `title1` (−12), lista em
`space.xl` (−16 de largura útil), `maxHeight` da capa em 170 (−26).

#### FAB

- Ø **56**, `radius.full`, `c.accent`, ícone `Plus` 26 em `c.fgOnAccent`.
  `REF:` Ø 54,7.
- `right: 16` (REF 18,2), `bottom` = altura da tab bar + 16.
- **Único elemento de área colorida da tela.**

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | `ActivityIndicator` em `c.accent`, centralizado. Nada de esqueleto de capa — não sabemos se há capa. |
| Vazio | Coelho `reading` **120** + `text.title2`/`c.fg` + uma linha `text.body`/`c.fgMuted` que diz o que produz post ("ninguém estudou ainda hoje — comece uma sessão"), nunca "nenhum post ainda". Sem botão: o FAB já está na tela. |
| Erro (sala não carrega) | Coelho `worried` 96 + "Não deu para abrir a sala" + "Tentar de novo" em `c.accent`. Hoje a tela devolve `null` silenciosamente quando `room` é nulo (`room/[id].tsx:64`) — **isso é uma tela em branco e é um defeito.** |
| Sem desafio ativo | O bloco 3+4 vira uma chamada neutra: `text.overline`/`c.fgMuted` "Nenhum desafio rolando" + ação "Criar desafio" em `c.accent`, num card de `padding: 16`. **Não se desenha capa vazia.** (Já é o comportamento de hoje — mantenha.) |
| Sem foto no post | Ver miniatura, acima. |

#### O que sai em relação a hoje

1. `text.title1` (40) no título → `text.title2` (28). §3.2.1.
2. `paddingHorizontal: space.xl` (24) → `space.lg` (16), e com ele o
   `marginHorizontal: -space.xl` do `hero` **e** a constante `COVER_WIDTH`.
3. `maxHeight: 170` da capa → `150`.
4. Linha de post sobre o fundo da página → **card** `c.surface` + borda + raio.
5. Separador de dia de `text.label` (14) → `text.caption` (12).
6. `styles.empty` como texto solto → estado vazio com coelho (§4.4).
7. O `return null` silencioso quando a sala não carrega → estado de erro.

---

### 5.2 Detalhe do post — `app/league/feed/post/[id].tsx` + `components/feed/PostCard.tsx`

Referência: `gr-en-14-workout.png`. **É aqui que a prova é publicada grande** —
o outro lado da decisão da §3.1, e por isso esta tela não é secundária.

#### Blocos

| # | Bloco | Altura | Respiro abaixo | REF (do topo da tela) |
|---|---|---|---|---|
| 1 | Barra de navegação (voltar + `⋯`) | 44 | 12 | ~57–80pt |
| 2 | **A foto da prova** | **largura 361, proporção nativa** | 20 | topo a **102pt**, altura **468,3pt** |
| 3 | Byline (avatar + nome + data) | 34 | 14 | 590 → 623 = 33pt |
| 4 | Matéria (ponto + nome) | 20 | 14 | 637 → 656 = 19pt |
| 5 | **Fileira de pills** | **40** | 24 | **704,6 → 744,1 = 39,5pt** |
| 6 | **Legenda** | conteúdo | 24 | 670 → 681 |
| 7 | Rodapé social (`PostSocialFooter`) | conteúdo | — | comentários a partir de 765 |

#### 2 — A foto

**O número que decide esta tela:** `REF:` a foto ocupa **468pt de 852**, ou seja
**55% da altura da tela**, largura cheia do card, e é o primeiro bloco abaixo da
barra de navegação.

- **Proporção nativa da imagem, não 4:3 fixo.** `REF:` a foto da referência é
  retrato 0,763:1 (≈3:4) e é mostrada inteira, sem corte. Hoje `PostCard.tsx`
  força `aspectRatio: 4/3` com `resizeMode="cover"` — isso **recorta a prova**.
  A prova não pode ser recortada.
  **Implementação:** `Image.getSize` ou `onLoad` para ler a proporção real e
  aplicá-la, com **teto de `aspectRatio: 3/4`** (retrato máximo) para uma foto
  muito alta não empurrar todo o resto para fora da tela.
- `borderRadius: radius.sm`, largura total do card (as margens negativas de hoje
  ficam), `borderWidth: 0` (a foto é a própria aresta).
- **Sem esqueleto** (`MARCA §3.3`): enquanto carrega, o bloco tem a altura já
  calculada e o fundo é `c.skeleton`. Um bloco que aparece e some é pior que
  nada.

#### 3–6 — O resto do card

| Bloco | Tipografia | Cor |
|---|---|---|
| Avatar do byline | 32×32, `radius.full` | placeholder `c.surfaceRaised` + iniciais `text.caption`/`c.fgMuted` |
| Nome | `text.bodyStrong` | `c.fg` |
| Data/hora | `text.caption` | `c.fgMuted` |
| Ponto da matéria | 8×8, `radius.full` (§3.2.2) | cor da matéria |
| Nome da matéria | `text.title3` | `c.fg` — **nunca na cor da matéria** |
| Legenda | `text.body` | `c.fg` |
| Pill | `text.label`, `paddingHorizontal: 14`, altura **40** | fundo `c.surface`, borda 1px `c.border`, texto `c.fg` |
| Minutos (1º pill) | `text.label` com `fontFamily` de `bodyStrong` | `c.fg` |
| `✓` verificado | colado ao pill de minutos, **não é pill próprio** | `c.success` |
| Linha do desafio | `text.caption` | `c.fgMuted` |

`REF:` os pills medem **39,5pt de altura** e ficam a 23,7pt abaixo da legenda,
com ~10pt entre eles. Hoje o `dataPill` usa `paddingVertical: space.sm` (8) e sai
com ~37pt — suba para 40 fixo.

**A ordem dos pills não muda: minutos primeiro, sempre.** É a North Star.

#### ⚖️ Decisão do CEO — pills **antes** da legenda

Esta seção media a referência e punha a legenda no bloco 5, antes dos pills,
invertendo `MARCA §3.2` (DataRow no 4, Caption no 5) **sem registrar a
discordância** — o que a §0 deste documento proíbe. O Dev de Componentes não
resolveu sozinho e trouxe para mim, corretamente. **A tabela acima já está
corrigida; `MARCA` vence.** Três razões, a terceira sendo a que decide:

1. O briefing §6 lista a anatomia de `MARCA §3.2` como decisão que não reabre, e
   ela está travada por `lib/post-card-structure.test.ts`.
2. **A medição está certa e mesmo assim não se aplica.** Na referência, a posição
   antes dos pills é ocupada pelo **título do treino** — elemento dominante e
   sempre presente. A nossa é uma **legenda opcional**, ausente na maioria dos
   posts. `DIRECAO-PRODUTO §7` nomeia essa armadilha: *"o dado do nosso card é
   outro… conteúdo diferente muda hierarquia"*. Copiar a posição enquanto o
   conteúdo é outro é copiar o pixel e perder a estrutura.
3. **Bloco opcional vai por último, ou o card muda de forma.** `MARCA §3.4` fixa
   o princípio que governa a tela pós-timer: *"o card não muda de forma quando
   você adiciona legenda ou foto"*. Com a legenda antes dos pills, todo post sem
   legenda faz os pills subirem — e escrever uma legenda reflui o card. É
   exatamente a leitura de "incompleto → pendente → formulário" que a §3.4 existe
   para evitar. Nenhum dos dois documentos tinha dito isto; é o argumento que
   fecha a questão.

Fica registrado o contraste: no `PostCard` o teste de estrutura estava **certo** e
o código se curvou a ele; em `lib/room-theme-migration.test.ts` o teste estava
**errado** (protegia a forma intermediária da migração) e foi reescrito para
exigir a forma de destino. Teste que quebra não está automaticamente certo nem
automaticamente errado — mas é sempre uma pergunta, nunca um obstáculo.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | `PostCardSkeleton` já existe e está certo: avatar, duas barras, coluna do dado, tudo em `c.skeleton`. **Sem shimmer.** |
| Vazio | Não existe: um post sem conteúdo não é aberto. |
| Erro (post não está no cache) | Hoje: uma linha "postUnavailable" centralizada. Passa a: coelho `worried` 96 + a linha + "Voltar para o feed" em `c.accent`. |
| Sem foto | **O bloco 2 não existe.** O card começa no byline e encurta. Nenhum substituto, nenhuma moldura, nenhum coelho — aqui não é miniatura, é o corpo do post. |
| Sem legenda | Linha ausente. Sem "(sem legenda)". |
| Sem reação | Contagem zero = pill ausente. **Nunca "0 🔥".** |
| Não verificado | **Não mostra nada.** Sem selo cinza. |

#### O que sai em relação a hoje

1. `aspectRatio: 4/3` fixo com `cover` → proporção nativa com teto de 3/4.
2. `body: { padding: space.xl }` (24) → `space.lg` (16), para a foto ganhar os
   16pt de largura que a referência dá a ela.
3. Pills de altura implícita → 40 fixo.
4. "postUnavailable" como texto solto → estado de erro com coelho.

---

### 5.3 Placar / rankings — `app/league/challenge/[id].tsx`

Referência: `gr-en-14-be-accountable.png`.

#### Blocos

| # | Bloco | Altura | Respiro abaixo | REF |
|---|---|---|---|---|
| 1 | Barra de navegação | 44 | 12 | — |
| 2 | Título do desafio | 38 | 12 | cap-top 96,7 |
| 3 | **Barra de progresso** | **18**, `radius.full` | 8 | **18,2pt**, largura total |
| 4 | Linha "Começou … / Termina …" | 20 | 24 | ~12pt de texto |
| 5 | Cabeçalho "Classificação" | 22 | 12 | ~16pt bold |
| 6 | **Card único com todas as linhas** | 58 × N | 24 | pitch **57,4pt** |
| 7 | Linha "Ver tudo ›" (se truncado) | 48 | — | ~46pt |
| — | Tab bar da sala | 66 | — | — |

#### 3 — A barra de progresso

- Altura **18**, `radius.full`, largura total (361).
- Trilho `c.surfacePressed`; preenchimento `c.accent`.
- Preenchimento = fração de tempo **decorrido** do desafio, não de métrica.
  `REF:` a barra deles anda com o calendário — é "quanto do prazo já foi".
- Quando faltam ≤3 dias, o preenchimento vira `c.deadline`. Único uso de
  `deadline` nesta tela. `MARCA §3.5` — "uma cor por superfície".

#### 6 — A linha do placar, medida

```
pitch da linha    58            REF 57,4
avatar            40, círculo   REF 39,5
inset esquerdo     8            REF 8,5
inset direito     16            REF 19,4
padding vertical   9            REF 8,7
divisória         hairline c.border, recuada até a coluna do nome (x = 8+40+12 = 60)
```

| Zona | Conteúdo | Tipografia | Cor |
|---|---|---|---|
| Avatar | 40, `radius.full`, **sem aro de medalha** | — | placeholder `c.surfaceRaised` **liso** (§3.3: o `CastleMark` sai) |
| Pessoa | nome; "· você" é **texto**, não badge | `text.bodyStrong` | `c.fg` |
| Métrica | "347 min" abaixo do nome | `text.caption` | `c.fgMuted` |
| Posição | ordinal à direita: numeral + sufixo | numeral `text.title3` (20) / sufixo `text.label` (14) | ambos `c.fg` |

`REF:` a métrica deles é 12pt (`caption`), não 14. `MARCA §3.6` pede
`text.label`; hoje o código usa `text.label`. **Desce para `text.caption`** — é o
número que a referência usa e é o que mantém o nome como o elemento que domina
a linha.

- **Sem pódio, sem ouro/prata/bronze, sem coroa.** A posição é tipografia.
  `LeaderboardPodium.tsx` morre (§3.4).
- **Empates:** ranking competitivo padrão — `1º, 2º, 2º, 4º`. `REF:` a referência
  mostra exatamente isso ("1st, 2nd, 2nd, 4th").
- **A minha linha** é a única com marca: fundo `c.accentSoft` e barra de **3pt**
  em `c.accent` à esquerda. Texto continua `c.fg`; posição e métrica **não** são
  pintadas. Já é o que o código faz — mantenha.
  > No claro, `accentSoft` é o azul claro a 35% e `accent` é o azul escuro
  > `#0043BA`: duas matizes de azul no mesmo elemento. Funciona porque uma é
  > preenchimento e a outra é traço, mas **peça um olhar do Eng. de Verificação
  > nesta linha específica no claro** — é o único lugar do app onde as duas
  > variantes de azul se encostam.

#### 6 — O card

Na referência **todas as linhas vivem dentro de um card branco só**, com
divisórias internas — não são cards separados como no feed. Faça igual:
`c.surface`, `radius.sm`, borda 1px, e `borderBottomWidth: 1` `c.border` em cada
linha menos a última, recuada até a coluna do nome.

Isso é o oposto do feed (§5.1), e de propósito: no feed cada post é um objeto
independente; no placar as linhas são uma tabela.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | Esqueleto: 5 linhas de 58pt com avatar circular e duas barras em `c.skeleton`. Aqui a forma é conhecida — esqueleto é melhor que spinner. |
| Vazio (desafio sem participante) | Coelho `reading` 120 + "Ninguém pontuou ainda" + "Convidar" em `c.accent`. |
| Erro | Coelho `worried` 96 + "Tentar de novo". |
| Desafio encerrado | O topo declara o vencedor: coelho `trophy` **132** + nome + `text.title2`. O placar congela. **É o payoff do prazo** — hoje não existe. |
| Sem foto de perfil | Avatar com iniciais em `text.caption`/`c.fgMuted` sobre `c.surfaceRaised`. |

#### O que sai em relação a hoje

1. `CastleMark` no tile de miniatura → tile liso (§3.3).
2. Miniatura de 48pt `radius.md` à esquerda **e** avatar → só o avatar de 40,
   circular. Hoje a linha tem miniatura de foto de post *no lugar* do avatar; a
   referência mostra a **pessoa**, não a última foto dela.
3. Linhas soltas com `borderBottom` sobre o fundo → um card único.
4. Métrica de `text.label` → `text.caption`.
5. `header` com título em `text.title3` e subtítulo → título em `text.title2` na
   linha de baixo, barra de progresso, e datas (o layout da referência).

---

### 5.4 Details da sala — `app/league/details/[id].tsx`

Referência: `gr-en-14-be-accountable.png` (metade de baixo) e `gr-en-14-team-up.png`.

#### Blocos

| # | Bloco | Altura | Respiro abaixo | REF |
|---|---|---|---|---|
| 1 | Barra de navegação | 44 | 12 | — |
| 2 | Nome da sala | 38 | 12 | — |
| 3 | Barra de progresso | **18** | 8 | 18,2pt |
| 4 | "Começou … / Termina …" | 20 | 24 | ~12pt |
| 5 | Bloco de convite (ícone + código + link) | 76 | 24 | ícone 22, código ~17pt, link ~14pt |
| 6 | "Classificação" (cabeçalho) | 22 | 12 | ~16pt bold |
| 7 | Card das 4 primeiras linhas + "Ver tudo ›" | 58×4 + 48 | 24 | — |
| 8 | "Estatísticas do grupo" (cabeçalho) | 22 | 12 | — |
| 9 | Card de estatísticas | 58 × N | 24 | pitch ~57pt |
| 10 | "Sair da sala" | 48 | — | — |

#### 5 — Convite

- Ícone `Share2` 22 em `c.fgMuted`, código em `text.title3` com
  `letterSpacing: 3` em `c.fg`, link "Convidar" em `text.bodyStrong` / `c.accent`.
- `REF:` a referência põe ícone e código na **mesma linha, alinhados à esquerda**,
  e o link "Invite" na linha seguinte, também à esquerda. Hoje o código
  centraliza tudo (`inviteBlock: { alignItems: 'center' }`). **Alinhe à
  esquerda** — a referência não centraliza nada fora de estado vazio.
- Hoje o código usa `text.title2` (28) no código de convite; `REF:` ~17pt.
  **Desce para `text.title3`** (20).

#### 9 — Estatísticas do grupo

`REF:` cada linha é `[ícone 22] [valor] / [rótulo]` com **valor acima do rótulo**,
não lado a lado.

| Bloco | Tipografia | Cor |
|---|---|---|
| Ícone | 22 | `c.fgMuted` |
| Valor | `text.bodyStrong` | `c.fg` |
| Rótulo | `text.caption` | `c.fgMuted` |

Hoje o código usa `text.title2` (28) para o valor, lado a lado com o rótulo em
`text.body` (16). **`REF:` o valor deles é ~15pt.** 28pt é um "número grande",
e §2.2 diz que não existe número grande. Corrija.

`gr-en-14-team-up.png` mostra a variante em grade 3×2 dentro de um card, com
valor ~17pt e rótulo ~13pt — use a grade quando houver 6 estatísticas, a lista
quando houver 3.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | Spinner `c.accent`. |
| Vazio (sala sem desafio) | Barra, datas e estatísticas somem; sobram convite e membros, e uma chamada "Criar desafio" em `c.accent`. |
| Erro | Já existe e está certo (texto + "Tentar de novo") — troque o texto solto pelo coelho `worried` 96. |
| Sem superlativo (madrugador / coruja) | Linha ausente. Nunca "—". |

#### O que sai em relação a hoje

1. Título em `text.title1` (40) → `text.title2` (28).
2. Barra de progresso de 8 → **18**.
3. Código de convite em `text.title2` centralizado → `text.title3` à esquerda.
4. Valor de estatística em `text.title2` (28) ao lado do rótulo → `bodyStrong`
   (16) acima do rótulo em `caption`.
5. Linhas de ranking soltas → card único (§5.3).

---

### 5.5 Chat — `app/league/chat/[id].tsx`

Referência: `gr-en-14-stay-motivated.png`. Medi as bolhas.

#### Blocos

| # | Bloco | Altura | REF |
|---|---|---|---|
| 1 | Cabeçalho: voltar + nome da sala **centralizado** | 56 | ~15pt bold, centralizado |
| 2 | Carimbo de hora (a cada bloco de tempo) | 32, centralizado | ~12pt |
| 3 | Nome do remetente | 20 | ~13pt, acima da bolha, alinhado ao lado da bolha |
| 4 | Bolha | **34** com 1 linha, **+20 por linha extra** | 33,4pt / 52,8pt com 2 linhas |
| 5 | Barra de composição | 56 + inset | — |

#### 4 — A bolha

```
minHeight          34             REF 33,4
paddingVertical     8
paddingHorizontal  14
borderRadius       radius.md (14) REF ~16
avatar             28, círculo, alinhado ao PÉ da bolha
gap avatar→bolha   10             REF: bolha começa a 54–56pt da borda da tela,
                                  com margem 16 + avatar 28 + gap 10 = 54
largura máxima     78% da tela
```

| Quem | Fundo | Texto | Lado |
|---|---|---|---|
| Outros | `c.surface` + borda 1px `c.border` | `text.body` / `c.fg` | esquerda |
| Você | `c.accent` | `text.body` / `c.fgOnAccent` | direita |

> ⚠️ **Defeito que eu encontrei e que já foi consertado enquanto eu escrevia —
> registrado porque explica por que este documento diz `c.fgOnAccent` em toda
> superfície colorida.** `light.fgOnAccent` era `#0A0A0C`, e `light.accent` é
> `#0043BA`: near-black sobre azul escuro dá ~1,8:1, ilegível. Isso não afetava
> só a bolha — afetava o ícone do FAB e o texto de todo botão primário do app.
> O Tech Lead trocou para `#FFFFFF`. **Use `c.fgOnAccent` e nada mais**; se
> alguém escrever um branco à mão em cima de `accent`, o conserto se perde no
> escuro.

- Nome do remetente: `text.caption` / `c.fgMuted`, `marginBottom: 4`.
- Carimbo de hora: `text.caption` / `c.fgMuted`, centralizado.
- `REF:` a referência **não** agrupa bolhas consecutivas do mesmo autor sem
  repetir o nome — cada bolha repete o nome. Faça igual.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | Spinner `c.accent`. |
| Vazio | Coelho `wave` 120 + "Ninguém falou ainda" + uma linha `c.fgMuted`. |
| Erro ao enviar | A bolha fica com `opacity: 0.4` e ganha um `↻` de 16 em `c.danger` à direita. **Nunca `Alert.alert`.** |
| Sem foto de perfil | Avatar com iniciais. |

#### O que sai em relação a hoje

O arquivo inteiro está em `const COLORS` com `fontSize` cru (17, 28, 13…).
**Migração para `useTheme()` + `text` é a entrega desta tela**, e todos os
números acima assumem que ela aconteceu. Sai também `backButtonText` como
caractere tipográfico de 28pt — vira o ícone `ArrowLeft` 22 em `c.fg`, como todas
as outras telas.

---

### 5.6 Criar sala — `app/league/create.tsx`

**Sem referência.** `INFERIDO:` inteiro, por analogia com a disciplina medida.

`FLUXO §5` é explícito: **dois campos.** Nome da sala e como você aparece. 840
linhas viram ~120.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Cabeçalho: `X` à esquerda + "Nova sala" centralizado | 56 | 16 |
| 2 | Campo "Nome da sala" | 54 | 16 |
| 3 | Campo "Como você aparece" | 54 | — |
| — | Botão primário, no rodapé | 54, margem 16 | inset |

| Bloco | Tipografia | Cor |
|---|---|---|
| Título do cabeçalho | `text.bodyStrong` | `c.fg` |
| Campo | `text.body`, altura 54, `radius.lg`, `paddingHorizontal: 16` | fundo `c.surface`, borda 1px `c.border`, texto `c.fg`, placeholder `c.fgSubtle` |
| Botão | `text.bodyStrong` | fundo `c.accent`, texto `c.fgOnAccent` |
| Botão desabilitado | — | `opacity: 0.4` |

Depois de criar: a mesma tela vira **código + botão de compartilhar** —
código em `text.title3` com `letterSpacing: 3` / `c.fg`, e "Compartilhar convite"
em `c.accent`. Nada de `Alert.alert` de parabéns.

**O que morre aqui, e é ~700 linhas:** datas de início e fim, durações rápidas de
7/30/90/365, modo easy/competitive/hardcore, slider de 2–100 membros, toggle
público/privado. Tudo isso é **desafio**, não sala, e migra inteiro para §5.7.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando (salvando) | `ActivityIndicator` em `c.fgOnAccent` dentro do botão. |
| Vazio | Não existe. |
| Erro | Linha `text.caption` / `c.danger` abaixo do campo culpado. **Nunca `Alert.alert`** — hoje é `Alert.alert`. |

---

### 5.7 Criar desafio — `app/league/challenge/new.tsx`

**Sem referência.** `INFERIDO:`. O arquivo de hoje já está perto; os ajustes são
de escala e de cor.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Cabeçalho: `X` + "Novo desafio" | 56 | 16 |
| 2 | Campo "Nome do desafio" | 54 | 16 |
| 3 | Rótulo "Como se registra" | 20 | 8 |
| 4 | Dois cards de modo (Foto / Estudo) | **136** | 16 |
| 5 | Rótulo "Duração" | 20 | 8 |
| 6 | Três pills (7 / 14 / 30 dias) | 46 | — |
| — | Botão primário no rodapé | 54 | — |

| Bloco | Tipografia | Cor |
|---|---|---|
| Rótulo de seção | `text.overline` | `c.fgMuted` |
| Card de modo — título | `text.bodyStrong` | `c.fg` |
| Card de modo — subtítulo | `text.caption` | `c.fgMuted` |
| Card de modo — ícone | 22 | `c.fgMuted` (não selecionado) / `c.accent` (selecionado) |
| Card selecionado | — | borda `c.accent`, fundo `c.accentSoft` |
| Pill de duração | `text.label` | `c.fg`; selecionado igual ao card |

Hoje o `modeCard` tem `minHeight: 150` e o ícone não selecionado usa `c.fg` —
**desce para 136 e o ícone não selecionado vai para `c.fgMuted`**, senão os dois
cards competem antes de haver escolha.

**A escolha do modo é a decisão mais consequente do app** (`DIRECAO-PRODUTO §6`:
o modo estudo é o que liga a presença ao vivo). Ela merece os dois cards e a
altura; não vire um toggle.

#### Estados

Idênticos à §5.6. Erro sai do `Alert.alert` e vira linha em `c.danger`.

---

### 5.8 Entrar por link — `app/league/join/[code].tsx`

**Sem referência** para a tela; o *preview* deriva do hero de §5.1.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Barra de navegação | 44 | 12 |
| 2 | Título "Você foi convidado" | 34 | 16 |
| 3 | **Card de preview da sala** | capa 144 + faixa 56 | 24 |
| 4 | Campo "Como você aparece" | 54 | — |
| — | Botão "Entrar" no rodapé | 54 | — |

#### 3 — O card de preview

**É o mesmo bloco da §5.1 (capa + faixa de três colunas), sem alteração.** É a
razão de ele existir: quem chega por convite vê exatamente a sala que vai
encontrar. Mesma capa (`roomCoverForId`), mesma faixa de 56pt, mesmas colunas —
com "Membros" no lugar de "Você" quando ainda não se é membro.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | Esqueleto do card: retângulo 361×144 + faixa 56, tudo `c.skeleton`. A forma é conhecida. |
| Código inválido | Coelho `worried` 96 + "Esse convite não existe mais" + "Digitar outro código" em `c.accent`. |
| Sala cheia / desafio encerrado | Faixa `text.caption`/`c.warning` sobre `c.surface`, acima do botão. Botão desabilitado. |
| Erro de rede | Coelho `offline` 96 + "Tentar de novo". |

#### O que sai em relação a hoje

1. O `getColors(c)` que remapeia a paleta e os `fontSize` crus (28, 22, 14, 13,
   11) — **o arquivo inteiro migra para `useTheme()` + `text`.**
2. O `Alert.alert` de sucesso (`join/[code].tsx:89`). `FLUXO §2` já pediu:
   alerta de parabéns antes de mostrar o produto é uma porta fechada na cara de
   quem acabou de aceitar um convite. **Entra direto no feed da sala.**
3. O `modeBadge` easy/competitive/hardcore — não existe no modelo novo.

---

### 5.9 Publicar foto — `app/league/post/[id].tsx`

**Sem referência direta**; GymRats não expõe essa tela nas capturas. `INFERIDO:`.
É a porta "Foto" de `DIRECAO-PRODUTO §6`, e é o caminho que o FAB abre.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Cabeçalho: `X` + "Nova publicação" | 56 | 16 |
| 2 | **A foto** (ou as duas escolhas) | ver abaixo | 16 |
| 3 | Legenda | mín. 84 | — |
| — | Botão "Publicar" no rodapé | 54 | — |

#### 2 — A foto

- **Antes de escolher:** dois cards lado a lado, `flex: 1`, `aspectRatio: 1`,
  `radius.lg`, fundo `c.surface`, borda 1px `c.border` — "Tirar foto" (`Camera`
  24) e "Escolher da galeria" (`ImageIcon` 24), ícone em `c.fg`, texto
  `text.label`/`c.fg`. Já é o que existe; mantenha.
- **Depois de escolher:** a foto na **proporção nativa**, largura total,
  `radius.lg`, com teto de `aspectRatio: 3/4`. Mesma regra da §5.2 — hoje aqui é
  `4/3` fixo, e é o mesmo recorte da prova.
- Tocar na foto reabre a galeria. Um `×` de 28 em `c.surface` sobre `c.scrim`, no
  canto superior direito da foto, remove.

#### 3 — Legenda

`text.body` / `c.fg`, placeholder `c.fgSubtle`, `minHeight: 84`,
`borderBottomWidth: 1` `c.border`. **Sem contador de caracteres.**

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando (enviando) | `ActivityIndicator` em `c.fgOnAccent` dentro do botão, botão em `opacity: 1` — a espera é do upload e pode demorar. |
| Sem foto | Botão desabilitado (`opacity: 0.4`). É a única tela do app onde a foto é obrigatória, e está certo: um post avulso sem foto não é nada. |
| Erro de upload | Linha `text.caption`/`c.danger` acima do botão + o botão volta a "Tentar de novo". **Hoje é `Alert.alert` — sai.** A foto não pode ser perdida: mantenha o `photo` em estado. |

---

### 5.10 Pós-timer — `/session/published` `AINDA NÃO EXISTE`

**Sem referência.** `INFERIDO:` inteiro. É a peça central de `FLUXO §7` e de
`MARCA §3.4`, e essas duas seções **não se reabrem** — o que segue são os
números que faltavam nelas.

#### O princípio, antes dos números

> **O card não muda de forma quando você adiciona legenda ou foto.**

E: quando esta tela abre, **o post já existe**. Ela não publica nada.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Cabeçalho no passado: "Publicado em Sala X · agora" | 24 | 4 |
| 2 | (N salas) fileira de chips | 34 | 16 |
| 3 | **`<PostCard editable />`** — idêntico ao do feed | conteúdo | 24 |
| 4 | Botão "Ver no feed" | 54 | 12 |
| 5 | "Apagar post" | 44 | — |

| Bloco | Tipografia | Cor |
|---|---|---|
| Cabeçalho | `text.label` | `c.fgMuted` |
| Chip | `text.caption`, altura 34, `radius.full`, `paddingHorizontal: 12` | fundo `c.surface`, borda 1px `c.border`, texto `c.fg`; `×` 14 em `c.fgMuted` |
| Botão "Ver no feed" | `text.bodyStrong` | fundo `c.accent`, texto `c.fgOnAccent` |
| "Apagar post" | `text.label`, centralizado | `c.danger` |

#### As proibições, como checklist de revisão

Herdadas de `MARCA §3.4` e `FLUXO §8`. Se alguma aparecer, a tela está errada:

- [ ] barra fixa no rodapé com botão primário grande
- [ ] qualquer verbo no futuro ou imperativo: "Publicar", "Concluir", "Finalizar"
- [ ] botão "Pular" ou "Agora não"
- [ ] foco automático no teclado
- [ ] a palavra "(opcional)"
- [ ] contador de caracteres
- [ ] glow, borda de destaque ou animação de "fresco" no card
- [ ] rodapé social (`PostSocialFooter`) — num post de 2 segundos as contagens
      são sempre zero

O botão "Ver no feed" **não** é barra fixa: ele rola com o conteúdo, abaixo do
card, a 24pt dele.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando (~300ms) | `<PostCard loading />` — o esqueleto que já existe. **Nunca esqueleto para a foto.** |
| Sem legenda | Linha-convite "Adicionar uma legenda" em `text.body`/`c.fgMuted`, **na mesma posição e métrica de uma legenda real**. Sem borda, sem fundo, sem moldura. |
| Sem foto | "+ foto" como ação textual `text.label`/`c.fgMuted`, na altura de qualquer ação secundária. **Nunca um dropzone.** |
| **Zero salas** | Cabeçalho vira "Nenhuma sala ainda"; o card continua (a sessão foi real). Uma ação: "Criar sala ou entrar por link" em `c.accent`. |
| **O `end` não devolveu post** | **Não monte card fantasma.** Mostre o resumo da sessão (minutos, matéria, XP) em `text.body`/`c.fg` e uma linha "Ainda não apareceu no feed · Tentar de novo" em `c.accent`. `FLUXO §0` documenta o modo de falha: `leagueMember.update` e `feedPost.create` não são atômicos. |
| Erro ao apagar | Linha `text.caption`/`c.danger`, sem alerta. |

---

### 5.11 Lista de salas (home) — `app/(tabs)/index.tsx`

**Sem referência.** `INFERIDO:`. Temos a captura do **nosso** app aqui
(`estado-atual/01-lista-de-salas-DEPOIS-claro.png`), e ela mostra os dois
defeitos.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Título "Suas salas" | 38 | 16 |
| 2 | Linha de sala (card) | **72** | 12 |

#### 2 — A linha de sala

Mesma anatomia da linha de post (§5.1), e de propósito — é a mesma gramática:

```
altura      72
fundo       c.surface
raio        radius.sm
borda       1px c.border
padding-esq  8
gap          12
```

| Bloco | Regra | Token |
|---|---|---|
| Miniatura da capa | `ROOM_ROW_THUMB` 72×40, `radius.sm`, **+ borda 1px `c.border`** (§3.2.6) | fundo `c.surfaceRaised` |
| Nome da sala | 1 linha | `text.bodyStrong` / `c.fg` |
| Sublinha | "8 pessoas · faltam 3 dias" | `text.caption` / `c.fgMuted` |
| Chevron | 18 | `c.fgSubtle` |

**A sublinha não existe hoje e é a maior perda da tela.** A captura mostra uma
sala com uma linha só de texto e um vazio de 1400pt embaixo. A referência nunca
tem uma linha de uma informação só: toda linha dela carrega título + sublinha.
Sublinha aqui: **quantas pessoas e quanto falta** — as duas perguntas que fazem
alguém entrar.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | Spinner `c.accent`. |
| Vazio | Coelho `wave` **150** + `text.title2` + `text.body`/`c.fgMuted` + botão "Criar sala" (54, `c.accent`) + linha de código + "Entrar". Já existe e está certo — **é um dos lugares onde o coelho entra legitimamente** (§3.3). |
| Erro | Coelho `worried` 96 + "Tentar de novo". Hoje um erro deixa a lista vazia sem dizer nada. |

#### O que sai em relação a hoje

1. `text.title1` (40) → `text.title2` (28). Na captura, "Your rooms" ocupa mais
   altura que a única linha de conteúdo da tela.
2. `paddingHorizontal: space.xl` (24) → `space.lg` (16).
3. `roomRow` com `borderBottomWidth` sobre o fundo → **card** (§4.2).
4. Miniatura de capa sem borda → com borda (§3.2.6). Na captura clara a onda azul
   flutua sem aresta.
5. Falta de sublinha → sublinha com pessoas + prazo.
6. **Strings em inglês numa UI em português** ("Your rooms"): a chave
   `rooms.listTitle` não tem tradução `pt-BR`, ou o locale não está resolvendo.
   Fora do meu escopo — **reporte ao CEO**, mas é o defeito mais visível da
   captura.

---

### 5.12 Perfil — `app/(tabs)/profile.tsx`

**Sem referência.** `INFERIDO:`. Tela em `const COLORS` hoje.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Título "Perfil" | 38 | 16 |
| 2 | Cabeçalho: avatar 72 + nome + e-mail | 72 | 24 |
| 3 | Card de números (sequência / minutos / nível) | 76 | 24 |
| 4 | Grupos de linhas de ajuste, em cards | 56 por linha | 24 entre grupos |

| Bloco | Tipografia | Cor |
|---|---|---|
| Nome | `text.title3` | `c.fg` |
| E-mail | `text.caption` | `c.fgMuted` |
| Número | `text.bodyStrong` | `c.fg` |
| Rótulo do número | `text.caption` | `c.fgMuted` |
| Linha de ajuste | `text.body` | `c.fg`; chevron 18 em `c.fgSubtle` |
| Linha destrutiva (sair) | `text.body` | `c.danger` |

O card de números segue a §5.4/§9: **valor acima do rótulo, `bodyStrong` sobre
`caption`, três colunas `space-evenly`** — a mesma faixa da §5.1. Uma gramática,
três telas.

**Aqui mora o seletor de tema.** Uma linha "Aparência" com valor à direita em
`text.label`/`c.fgMuted`: Claro / Escuro / Sistema. O escuro não sumiu, está a um
toque (`theme/index.ts`).

**Sai daqui:** a linha "Minhas Ligas" que empurra para `/league` (`profile.tsx:254`).
É a única porta para `app/league/index.tsx`, que `FLUXO §10` já matou. Remova a
linha primeiro; o arquivo depois (§3.4).

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | Esqueleto: círculo 72 + duas barras, em `c.skeleton`. |
| Sem foto | Avatar com iniciais em `text.title3`/`c.fgMuted` sobre `c.surfaceRaised`. |
| Erro | Coelho `worried` 96 + "Tentar de novo". |

---

### 5.13 Sessão / timer — `app/session/active.tsx` (+ `setup.tsx`)

**Sem referência** — o GymRats não tem timer. `INFERIDO:`, e é **a única tela do
app onde a escala grande é permitida**.

#### Blocos, centralizados verticalmente

| # | Bloco | Tamanho | Respiro abaixo |
|---|---|---|---|
| 1 | Voltar, absoluto no canto | 44 | — |
| 2 | Anel + número | Ø = `min(largura×0,72, 300)`, traço 6 | 24 |
| 3 | Matéria (ponto 8 + nome) | 20 | 8 |
| 4 | Marco + "faltam N min" | 36 | 16 |
| 5 | Pontos de ciclo (4×8) | 8 | 32 |
| 6 | Botão de pausa/play | 68, `radius.full` | 16 |
| 7 | "Encerrar" | 44 | — |

| Bloco | Tipografia | Cor |
|---|---|---|
| Número do timer | **`text.title1` (40)** | `c.fg` |
| Anel — trilho | traço 6 | `c.surfacePressed` |
| Anel — progresso | traço 6 | `c.accent` |
| Matéria | `text.label` | `c.fgMuted`; ponto 8 na cor da matéria (§3.2.2) |
| Marco | `text.label` | `c.accent` |
| "faltam N min" | `text.caption` | `c.fgSubtle` |
| Botão de pausa | ícone 26 | fundo `c.accent`, ícone `c.fgOnAccent` |
| "Encerrar" | `text.label` + `Square` 14 | `c.danger` |

**`text.display` (64) não é usado nem aqui.** `title1` (40) num anel de 300pt de
diâmetro já é o maior elemento do app inteiro; 64 estoura o anel em telas de
375pt e força quebra de linha em `1:59:59`.

**A regra que decide esta tela** (`FLUXO §7.1`): **segurar "Encerrar" por 400ms**,
com o anel se preenchendo em `c.danger`. O `Alert.alert` de confirmação
(`active.tsx:134`) **sai** — um diálogo com "Cancelar" é uma porta de saída no
único instante em que não pode haver uma.

E: `LevelUpAnimation` **não** chama `goHome()`. Ela termina em
`/session/published` (§5.10). Hoje a comemoração enterra o post
(`active.tsx:323`).

#### Estados

| Estado | O que aparece |
|---|---|
| Rodando | Como acima. |
| Pausado | Anel em `c.fgSubtle`, número em `c.fgMuted`, botão vira Play. |
| Desconectado | Faixa `text.caption`/`c.warning` sobre `c.surface` acima do anel; botão em `opacity: 0.4`. |
| Encerrando | "Encerrando…" em `text.label`/`c.fgMuted`, controles em `opacity: 0.4`. |
| Erro ao encerrar | O timer **não** some. Linha `text.caption`/`c.danger` + "Tentar de novo". Perder a sessão aqui é perder o produto. |

---

### 5.14 Onboarding — `app/onboarding/index.tsx`

**Sem referência.** `INFERIDO:`. É a segunda tela do app e a primeira impressão
depois do login.

#### Blocos por passo

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Barra de progresso | **3**, `radius.full` | 32 |
| 2 | Coelho | **132** | 24 |
| 3 | Pergunta | 38 | 8 |
| 4 | Uma linha de apoio | 24 | 32 |
| 5 | Opções (cards 64 ou chips 44) | — | 12 entre itens |
| — | Botão "Continuar" no rodapé | 54 | inset |

| Bloco | Tipografia | Cor |
|---|---|---|
| Barra — trilho | 3 | `c.surfacePressed` |
| Barra — progresso | 3 | `c.accent` |
| Pergunta | `text.title2` | `c.fg` |
| Apoio | `text.body` | `c.fgMuted` |
| Card de opção — título | `text.bodyStrong` | `c.fg` |
| Card selecionado | — | borda `c.accent`, fundo `c.accentSoft`, check 22 em `c.accent` |
| Chip de matéria | `text.label` + ponto 7 (§3.2.2) | fundo `c.surface`, borda `c.border` |

**Um coelho por passo, estado diferente por passo, e é o lugar onde ele mais
trabalha** (`MARCA §5`): `wave` → `thinking` → `reading` → `focused` → `happy`.
Tamanho **132** em todos; não varie por passo.

**Sem "Pular".** Pular ensina que havia algo a cumprir — a mesma regra da §5.10.
Se um passo é pulável, ele não é um passo: tire-o.

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando (salvando) | `ActivityIndicator` em `c.fgOnAccent` dentro do botão. |
| Nada selecionado | Botão em `opacity: 0.4`, desabilitado. |
| Erro | Linha `text.caption`/`c.danger` acima do botão. Nunca alerta — o onboarding não pode ter uma porta de saída modal. |

---

### 5.15 Login — `app/(auth)/login.tsx`

**Sem referência.** `INFERIDO:`. É a **única** tela do app que pode não ser
`c.bg`: ela usa `NIGHT_GRADIENT`, e isso é deliberado — é a moldura da marca,
não uma superfície de produto.

#### Blocos

| # | Bloco | Altura | Respiro abaixo |
|---|---|---|---|
| 1 | Fundo `NIGHT_GRADIENT` + símbolos fantasma | tela cheia | — |
| 2 | Marca (ícone + wordmark) | ícone **96** + wordmark | 12 |
| 3 | Pill da tagline | 34, `radius.full` | flex |
| 4 | Rótulo "Entrar com" | 20 | 12 |
| 5 | Botões sociais | 54 cada | 12 entre eles |
| 6 | Linha legal | 32 | inset |

| Bloco | Tipografia | Cor |
|---|---|---|
| Tagline | `text.caption` | branco a 70%; pill em branco a 12% |
| Rótulo "Entrar com" | `text.caption` | branco a 60% |
| Botão Apple | `text.bodyStrong` | fundo branco, texto near-black |
| Botão Google | `text.bodyStrong` | fundo branco, texto near-black |
| Legal | `text.caption` | branco a 45% |

**Sobre os 9 hex na mão deste arquivo:** o gradiente e as opacidades sobre ele
não têm token, e não devem ter — a paleta semântica descreve superfícies do
produto, e esta tela não é uma. **Recomendação:** promover as três paradas do
gradiente para `NIGHT_GRADIENT` (já existe) e deixar os brancos com alfa como
literais **com um comentário dizendo por quê**. Não vale criar
`c.fgOnGradient70`. Os 7 hex de `GoogleSignInButton.tsx` são a marca do Google e
são obrigatórios por guideline deles — **ficam**.

**O ícone da marca:** hoje é `assets/logo.png`, a grade azul de 9 quadrados.
`MARCA §5` e `PLANO §Etapa 3` já pediram a troca pelo coelho em silhueta. Aqui,
sobre o gradiente escuro, o coelho é a **silhueta branca** — é o único lugar
além do ícone do app onde o tratamento branco-sobre-azul se aplica (§3.3).

#### Estados

| Estado | O que aparece |
|---|---|
| Carregando | `ActivityIndicator` near-black dentro do botão tocado; os outros em `opacity: 0.4`. |
| Erro | Faixa acima dos botões: `text.caption` branco sobre `c.danger` a 90%, `radius.md`, `padding: 12`. Já existe (`errorBanner`) — mantenha. |
| Sucesso (link de e-mail) | Mesma faixa, `c.success`. Já existe. |

---

## 6. Tabela de conferência — todos os números numa página

Para o dev conferir sem reler o documento.

| Medida | Valor | Origem |
|---|---|---|
| Margem lateral, toda tela | **16** | REF 17,6 |
| Barra de navegação | **44** | REF |
| Título de tela | **`text.title2` (28)** | REF ~23 |
| Raio de card | **`radius.sm` (8)** | REF 6–7 |
| Borda de card | **1px `c.border`** | §3.2.4 |
| Capa da sala | **361 × 144**, proporção 2,5, teto 150 | REF 357×138, 2,59:1 |
| Faixa de três colunas | **56** (14+28+14), `space-evenly` | REF 52,8 (13,4+26+13,4) |
| Avatar da faixa | **28** | REF 26,7 |
| Separador de dia | **41** (12+17+12), `text.caption`, minúsculas | REF 37,7 |
| Linha de post | **72**, card, gap **12** | REF 69,9, gap 10,9 |
| Miniatura da linha | **56 quadrado** `radius.sm` | REF 48,6 círculo — divergência decidida (§3.1) |
| Avatar do byline da linha | **18** | REF 16 |
| Foto no detalhe do post | largura total, **proporção nativa**, teto 3/4 | REF 361×468, 55% da tela |
| Pill de dado | altura **40**, `radius.full`, `text.label` | REF 39,5 |
| Linha do placar | **58**, avatar **40** | REF 57,4 / 39,5 |
| Numeral de posição | `text.title3` (20) + sufixo `text.label` (14) | REF ~19–20 / ~14 |
| Barra de progresso — feed | **6** | `MARCA §3.5` |
| Barra de progresso — placar/details | **18**, `radius.full` | REF 18,2 |
| Bolha de chat | **34** (1 linha), **+20** por linha | REF 33,4 / 52,8 |
| FAB | **56**, `right: 16` | REF 54,7 / 18,2 |
| Botão primário | **54** | INFERIDO |
| Campo de formulário | **54**, `radius.lg` | INFERIDO |
| Coelho — home vazia | **150** | §3.3 |
| Coelho — onboarding, fim de desafio | **132** | §3.3 |
| Coelho — feed vazio, paywall | **120** | §3.3 |
| Coelho — erro, login | **96** | §3.3 |
| Coelho — miniatura sem foto | **34** em tile 56 `c.accentSoft` | §3.3 |
| **Posts visíveis numa tela de 852pt** | **4** | REF 4 |

## 7. As três coisas que, se saírem erradas, invalidam a noite

1. **A foto aparece.** Se qualquer tela terminar com placeholder no lugar da
   imagem, ela não terminou (`PLANO §Etapa 2`).
2. **Nenhum número grande.** Se houver `text.display` ou `text.title1` fora do
   timer, a tela não é o GymRats — é o app de ontem em fundo claro.
3. **A cor da tela são as fotos.** Se o `c.accent` aparecer fora do FAB, dos
   links de ação e da barra de progresso, tire.
