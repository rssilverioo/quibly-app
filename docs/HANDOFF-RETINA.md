# Handoff — Retina (identidade visual)

> Escrito em 2026-07-31, na troca de motor dos agentes. Para quem assume o
> papel e **nunca viu a conversa anterior**.
>
> A direção aprovada está em `MARCA.md` e não se repete aqui. Este documento é
> só **o que não coube lá**: onde estão os arquivos, o que foi lido e não
> escrito, onde o trabalho parou, e quais caminhos já foram descartados para
> você não repetir.

---

## 1. Quem é você e o que é seu

Dono da identidade visual do Quibly. Área: `apps/mobile/theme/` e
`apps/mobile/assets/`. Você **não** mexe em componente — quem constrói tela é o
Pulso, e há ordem explícita de combinar com ele antes.

**Sua árvore é `/Users/rodrigosilverio/Code/quibly-retina`, branch
`brand/identidade`.** Nunca dê `cd` nem `git checkout` em `~/Code/quibly-app` —
aquela árvore é de outro agente. Houve um incidente exatamente por isso: os 4
agentes estavam no mesmo diretório trocando de branch por cima uns dos outros.

Commits até aqui, os dois seus:

| | |
|---|---|
| `ecf0d6a` | `docs/MARCA.md` — a direção. **Aprovada pelo CEO.** |
| `5249e0b` | `scripts/contrast.mjs` + `docs/referencia/gymrats/` |

**Não há push nem PR, e não pode haver sem o CEO autorizar.** Ele foi explícito
duas vezes.

Leitura obrigatória antes de agir, nesta ordem: `DIRECAO-PRODUTO.md` (§3 e §7),
`MARCA.md`, e `FLUXO-TELAS-APP.md` (§8, o PostCard) do Pulso.

---

## 2. Os screenshots do GymRats — EXISTEM, estão commitados

**`docs/referencia/gymrats/`, no commit `5249e0b`.** Seis arquivos, 2.4 MB.

Isto é o ativo mais frágil do handoff: **não tente refazer o download.** Ele
custou caro e duas rotas estão fechadas.

| Arquivo | O que é |
|---|---|
| `gr-en-14-challenge.png` | **o mais importante** — o feed do desafio |
| `gr-en-14-workout.png` | detalhe de um post |
| `gr-en-14-be-accountable.png` | placar + estatísticas do grupo |
| `gr-en-14-team-up.png` | tela de time, grade de estatística |
| `gr-en-14-stay-motivated.png` | chat do grupo |
| `gr-icon.png` | o ícone deles, 512px |

**Como foram obtidos** (se algum dia precisar de mais): a página da App Store foi
baixada com `curl` e um `User-Agent` de navegador, as URLs de imagem extraídas do
HTML com `grep`, e cada imagem puxada no tamanho `900x1950bb.png` trocando o
sufixo da URL do `mzstatic`. A ficha é
`apps.apple.com/us/app/gymrats-fitness-challenge/id1453444814`.

**O que NÃO funcionou, não repita:**

- **Play Store:** `curl` volta com 1.6 KB (bloqueio anti-bot). Não há capturas
  de Android.
- **Captura por navegador:** as ferramentas `mcp__claude-in-chrome__*` navegam,
  mas `computer{action:"screenshot"}` falhou com `Failed to capture screenshot
  via CDP` em três tentativas seguidas, inclusive depois de esperar o load. Se
  precisar ver uma página, o caminho que funciona é `curl` + extrair a imagem +
  abrir com a ferramenta `Read` (ela renderiza PNG/JPG).
- **SVG não é lido pela ferramenta `Read`.** Para ver um `.svg`, converta antes:
  `qlmanage -t -s 512 -o <destino> <arquivo>.svg` funciona neste Mac
  (`rsvg-convert`, `cairosvg` e `inkscape` não estão instalados).

### O que li nos screenshots e não coube no MARCA.md

- **Detalhe do post (`workout`):** ordem exata dos blocos — foto quase quadrada
  em largura total no topo, depois avatar pequeno + nome + data por extenso
  ("February 3, 2025 at 1:48 PM"), título em bold, legenda, a fileira de pills, e
  os comentários. O botão de reagir é um **ícone de emoji-com-mais** na ponta
  direita da fileira de pills — não é uma fileira de emojis exposta como a nossa.
- **Feed (`challenge`):** a linha do post não tem nenhum dado numérico, mas tem a
  **hora** alinhada à direita ("1:48 pm"). Os separadores de dia são texto cinza
  centralizado, não alinhado à esquerda. O FAB `+` é vermelho, circular, canto
  inferior direito. A tab bar tem 3 itens: Details / Rankings / Chat — ou seja,
  **o feed não é uma aba, é a tela**, e o resto pendura nela. Isso confirma a
  inversão que o Pulso propôs.
- **Header do desafio:** capa 16:9 e sob ela três colunas — `1 Leader`, `1 You`,
  `29 days left`. As duas primeiras usam **avatar** como ícone; a terceira usa um
  ícone de calendário. Número em cima, label cinza embaixo.
- **Placar (`be-accountable`):** acima do ranking há uma **barra de progresso**
  fina, largura total, em vermelho, com `Started Jan 3, 2025` à esquerda e
  `Finishes Mar 4, 2025` à direita. É a única barra de progresso do app e é onde
  eles gastam a cor da marca. O código de convite aparece como texto puro
  (`AHNMQJRI`) ao lado de um ícone de compartilhar, com "Invite" em vermelho
  abaixo.
- **Empate no placar:** dois membros aparecem ambos como `2nd`, e o seguinte é
  `4th`. Ranking competitivo padrão. Vale replicar.
- **`team-up`:** a grade de estatística é 3 colunas × 2 linhas, número ~22px bold
  e label 13px cinza. É o maior "número" do app inteiro.
- **Chat:** balões cinza-claro para os outros, **vermelho para você**, nome do
  autor acima do balão, avatar ao lado. Convencional de propósito.
- **Tipografia:** geométrica arredondada (família Nunito/Quicksand). **Não
  confirmei o nome** — não trate como fato.

---

## 3. Onde o trabalho parou

`MARCA.md §7` tem a tabela de entregas. Estado real:

- **Entrega 1 — card do post:** direção fechada e aprovada. Passada ao Pulso em
  detalhe (hierarquia, blocos, props, estados). Ele constrói; você não.
- **Entrega 2 — card do desafio:** **é aqui que você retoma.** Os valores de
  `deadline`/`deadlineSoft` estão medidos mas não escolhidos — §4 abaixo.
- **Entrega 3 — linha do placar:** não começou. A decisão de direção já está
  tomada e registrada (`MARCA.md §4`): sem pódio, posição como tipografia
  (`1º`, numeral bold + ordinal menor e leve), `gold/silver/bronze` continuam na
  paleta mas o placar por desafio não os usa.
- **Entrega 4 — ícone:** não começou. Decisão ratificada pelo dono do produto:
  **castelo em silhueta chapada, urso sai.** Nome, bundle ID e fichas de loja não
  mudam.

### O que eu ia fazer no ícone e não cheguei a fazer

Ideia não validada, trate como ponto de partida e não como decisão: **silhueta
near-black (`#0A0A0C`) sobre campo lime (`#C8FF4D`)**, invertendo o app (escuro)
no ícone (claro). Contraste ~15:1, e resolve de graça a variante escura que o
iOS 18+ pede (marca lime sobre near-black). O motivo de não ser o contrário — o
padrão do GymRats é silhueta *branca* sobre campo de marca, mas o campo deles é
vermelho escuro e o nosso lime é claro demais para segurar branco.

O material de origem é `apps/mobile/assets/mascot/castelo-idle-night.svg`: um
castelo de tijolo com bandeira, já em `#C8FF4D`. Uma silhueta precisa perder os
tijolos, a sombra e o gradiente e virar **uma forma só**.

---

## 4. `deadline` / `deadlineSoft` — onde parei e o que já descartei

Rode `node scripts/contrast.mjs` — os números abaixo saem de lá.

**O problema declarado:** já existem `accent` (lime), `success` (verde),
`warning` (âmbar), `danger` (vermelho) e `live` (vermelho). Um token novo mal
escolhido transforma a paleta em semáforo.

### Já descartado, com o motivo

1. **Reusar `danger`.** Faria três vermelhos na paleta (`danger`, `live`,
   `deadline`). Pior que semáforo.
2. **Reusar `warning`.** Semanticamente tentador — "seu prazo está acabando" é um
   aviso. Descartado porque `warning` é *estado de sistema* e o prazo é o *motor
   do produto*: aparece o tempo todo e vai querer divergir (gradiente, animação).
   Compartilhar significa que mexer em `warning` muda silenciosamente o sinal
   central do produto. Separação semântica é para isso que o `colors.ts` existe.
3. **Um terceiro nível de urgência (`deadlineUrgent`).** Descartado para não
   inflar a paleta. A escalada acontece por **preenchimento, não por matiz**:
   calmo = texto em `fgMuted` sem fundo → apertando = pill com fundo
   `deadlineSoft` e texto `deadline` → encerrado = `fgSubtle`, no passado. **Uma
   matiz só, três pesos.** É o que mata o semáforo de vez, e é a parte da ideia
   que eu defenderia com mais convicção.

### Onde parei: âmbar-brasa, mais quente que o `warning`

Medido, com `deadlineSoft` = a mesma cor a 16% (escuro) / 14% (claro):

**Escuro** (sobre `surface` #131318 / sobre o pill) — todos passam folgado:

| Candidato | surface | pill | distância do `warning` |
|---|---|---|---|
| `#FF9F45` | 9.08 | 6.82 | 1.22 |
| `#FFA23A` | 9.24 | 6.88 | 1.20 |
| **`#FF8C3B`** | **7.99** | **6.17** | **1.39** ← melhor equilíbrio |
| `#FFB05C` | 10.24 | 7.45 | 1.08 |
| `#F59E4B` | 8.71 | 6.58 | 1.27 |

**Claro** (sobre `#FFFFFF` / sobre o pill) — `#C2570B` reprova no pill (3.73):

| Candidato | surface | pill | distância do `warning` |
|---|---|---|---|
| `#B4530A` | 5.02 | 4.15 | 1.58 |
| **`#A84C08`** | **5.67** | **4.64** | **1.78** ← passa nos dois |
| `#C2570B` | 4.50 | **3.73 ✗** | 1.41 |
| `#9A4507` | 6.50 | 5.26 | 2.04 (mas puxa para marrom) |
| `#AD5A12` | 4.94 | 4.11 | 1.55 |

**Minha inclinação, não confirmada: `#FF8C3B` no escuro, `#A84C08` no claro.**

**O que falta antes de fechar, e por que eu não fechei:** nunca vi essa laranja
ao lado do lime numa tela de verdade. A "distância do warning" acima é razão de
contraste, que mede claridade — **não mede se as duas cores parecem a mesma
coisa lado a lado**, e não existe teste numérico para "isso virou semáforo?".
Precisa de olho. Não feche no número sozinho.

---

## 5. Achado urgente que não é seu, mas você precisa carregar

O `scripts/contrast.mjs` encontrou **12 falhas de contraste na paleta que já
existe**, independentes do deadline. A paleta clara nunca tinha sido exercitada
— nenhuma tela a usava, todas importavam `staticDark`. O Pulso está migrando as
4 telas de sala para `useTheme()` agora, então ela vai ao ar pela primeira vez.

| Token | Escuro | Claro | Onde dói |
|---|---|---|---|
| `fgSubtle` | 2.57–3.00 ✗ | 2.67–2.78 ✗ | **falha nas duas.** É o token de timestamp e meta — no card do post é o "há 5 min" e a linha do desafio |
| `success` | ok | 3.16–3.30 ✗ | o `✓` de verificado no claro |
| `warning` | ok | 3.05–3.19 ✗ | qualquer texto de aviso no claro |

`accent` no claro passa (4.89–5.10) — a variante profunda `#4F7A00` que o
`colors.ts` já documentava funciona. Aquela disciplina estava certa.

**A decisão sobre isso é sua** — o CEO disse literalmente que o Pulso vai achar
contraste quebrado e que você é quem decide o que fazer com o que ele achar.
Ainda não decidi. A saída provável é escurecer/clarear os três, mas `fgSubtle`
existe justamente para ser apagado: subir o contraste dele achata a hierarquia
de três níveis (`fg` / `fgMuted` / `fgSubtle`) que o card depende. Pode ser que a
resposta certa seja **aposentar `fgSubtle` como cor de texto** e deixá-lo só para
ícone e separador — mas isso mexe em telas do Pulso e tem que ser combinado.

---

## 6. Estado dos outros agentes

`maestri list` mostra os conectados. Você é **"Retina"**; quem constrói tela é
**"Pulso"**; o contrato de API é do **"Raiz"**; QA é a **"Peneira"**.

O que já foi combinado com o Pulso e ele está executando:

- **Os nomes dos tokens NÃO mudam.** A interface `Palette` continua sendo o
  vocabulário; só valores evoluem. Ele está migrando as 4 telas de sala de
  `const COLORS` hardcoded para `useTheme()` **uma vez só**, com essa garantia.
  **Não renomeie nada da `Palette`** — isso quebraria o acordo e o obrigaria a
  migrar duas vezes. As 3 chaves novas (`deadline`, `deadlineSoft`, `skeleton`)
  são adição pura.
- Junto foi o aviso de que **4 mapeamentos atuais estão errados** e devem ser
  corrigidos na mesma passada: `surface: c.bg` (por isso o card tem a cor da
  página), `border: c.surfaceRaised`, `success: c.accent`, e
  `textSecondary`/`textMuted` **invertidos** em relação a `fgMuted`/`fgSubtle`.
- A estrutura completa do PostCard (blocos, props, estados, e as regras que
  impedem a tela pós-timer de virar formulário) foi passada a ele e está em
  `MARCA.md §3`.

---

## 7. As três coisas que, se você esquecer, o trabalho piora

1. **Diga o que não viu.** A §1.1 do `MARCA.md` — separar o que foi visto do que
   não foi, e recusar preencher lacuna com suposição — virou uma decisão do dono
   do produto ("não sabemos se o GymRats tem modo escuro, logo aqui não há
   referência para copiar"). Foi elogiado nominalmente. Não invente o que não
   verificou; registre a lacuna.
2. **Retire a própria ideia quando ela não sobreviver.** A §3.1 registra uma
   proposta minha (lista compacta no feed) que eu retirei depois de ver que a
   foto deles *ilustra* e a nossa é *prova*. O erro ficou escrito em vez de
   apagado, e isso foi elogiado. Não defenda desenho por autoria.
3. **A mecânica central mora no visual.** `DIRECAO-PRODUTO §3`: encerrar a sessão
   **cria** o post. Na tela pós-timer o post **já está publicado**; legenda e
   foto são enfeite opcional sobre algo que já existe. Se o card fizer aquilo
   parecer formulário a submeter, a mecânica morre mesmo com o backend certo. O
   princípio que protege isso: **o card não muda de forma quando você adiciona
   legenda ou foto** — a ausência tem que parecer decisão, não vazio.
