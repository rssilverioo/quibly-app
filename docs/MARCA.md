# Marca — a identidade visual do Quibly

> Escrito em 2026-07-31. Deriva de `DIRECAO-PRODUTO.md` e existe para servir o
> loop descrito lá. Onde este documento discorda de uma escolha visual anterior,
> este vale — mas ele **não** revoga a arquitetura de `theme/`, que fica.
>
> O nome continua Quibly. Nada de loja (bundle id, App Store, Play) está em
> discussão aqui.

---

## 0. A tese

A identidade de hoje foi desenhada para "a sala de estudo global com IA". O
produto virou outra coisa: **desafio com prazo, grupo pequeno de gente que se
conhece, prova publicada no feed.** A marca precisa carregar quatro palavras
novas — desafio, grupo, energia, prova — e largar duas velhas: vigilância e
escala.

A referência é o GymRats, por decisão do CEO. "Igual ao GymRats" significa
**clareza e estrutura**, não pixel. O conteúdo do nosso card é outro (minutos,
matéria, XP, foto da prova — não repetição, distância e caloria), e conteúdo
diferente muda hierarquia.

---

## 1. A referência — o que eu vi de fato

### 1.1 O que vi, e o que NÃO consegui ver

**Vi:** os 5 screenshots da App Store em resolução cheia (900×1950) e o ícone em
512px, baixados de `apps.apple.com/us/app/gymrats-fitness-challenge/id1453444814`.
São eles: *challenge* (feed do desafio), *workout* (detalhe do post), *team-up*
(tela de time), *be-accountable* (placar + stats), *stay-motivated* (chat).

**NÃO consegui ver, e não estou preenchendo com suposição:**

- **A Play Store.** O request voltou vazio (bloqueio anti-bot). Não sei se as
  capturas de Android diferem.
- **O app rodando.** A captura de tela por navegador falhou com erro de CDP em
  três tentativas. Não instalei nem operei o app.
- **O modo escuro deles.** Todo o material público que vi é claro. **Não sei se
  o GymRats tem modo escuro.** Isso importa porque nós somos dark-first — ou
  seja, em pelo menos uma dimensão central nós não podemos copiar, porque não
  temos referência.
- **A fonte exata.** É uma geométrica arredondada (família Nunito / Quicksand),
  mas não confirmei o nome.
- **Micro-interação, movimento, transições, som, háptico.** Screenshot não conta
  nada disso.

### 1.2 A leitura

**O feed deles não é um feed de cards. É uma lista compacta.** Linha de ~72px:
thumbnail quadrado ~56px à esquerda, título em bold, autor com micro-avatar
embaixo, hora à direita. Cabem 4 posts + o header do desafio + a tab bar numa
tela. A foto só cresce quando você abre o post. *(Ver §3.1 — eu tentei importar
isso e estava errado.)*

O resto do que a interface faz, e por que funciona:

- **Quem domina a linha é o título** ("Climb 🧗", "Yin Yoga", "Beach run &
  surf"), não a foto e não o número.
- **Não existe um número grande em lugar nenhum do app.** Nem um. Os dados moram
  em *pills* outline de 13–15px: `⏱ 45 min`, `❤️ Climbing · Apple Watch`. Onde há
  grade de estatística, é número ~22px bold + label 13px cinza. A hierarquia do
  dado vem de **posição e exclusão**, nunca de escala.
- **Separadores de dia** em cinza — "Today", "Yesterday", "Tuesday, Jan 28" —
  dão pulso ao feed de graça.
- **Onde gastam cor: em quase nada.** O vermelho aparece em três lugares — o FAB
  `+`, os links de ação ("Invite", "Add member") e a barra de progresso do
  desafio. Todo o resto é preto e cinza sobre branco. **A cor da tela são as
  fotos das pessoas.** É isso que faz a interface parecer viva sem gastar
  pigmento em chrome.
- **Placar:** avatar, nome, sublinha cinza ("3 days active"), posição à direita
  como `1ˢᵗ` — numeral bold, sufixo menor e leve. **Sem medalha, sem
  ouro/prata/bronze.** A posição é tipografia, não ornamento.
- **O prazo está sempre visível:** sob a capa do desafio, uma faixa de três
  colunas — `1 Leader`, `1 You`, `29 days left`.
- **Tipografia:** dois pesos só, bold e regular. Escala curta. Títulos de tela
  ~28px, alinhados à esquerda.
- **Ícone:** o mascote deles — rato flexionando, **silhueta branca chapada**
  sobre gradiente vermelho. Legível em 16px.

---

## 2. Diagnóstico — o que temos hoje

**Fica, e não se discute:** a arquitetura de `theme/colors.ts` e `theme/tokens.ts`.
Tokens semânticos, dark-first, escala tipográfica curta, `useTheme()` já existindo
e já usado em ~10 telas, e a regra de que tela nunca escreve hex. Isso é base boa.

O que está no posicionamento velho:

1. **O card do feed tem cinco blocos brigando.** Pill de matéria, a frase
   "Studied for 45 minutes", `+120 SP` em 22px peso 800 lime, pill "Verified", e
   um bloco de foto. ~200px por post e nenhuma hierarquia. Rolando rápido não se
   lê nada.
2. **A foto da prova não é exibida.** `app/league/feed/[id].tsx:381-388` desenha
   um retângulo cinza com ícone de câmera e o texto "prova enviada". **A prova é
   o motor do produto e nós a escondemos** — enquanto no GymRats a foto *é* a
   interface. Esse mesmo retângulo vazio é, por acidente, o pior padrão possível
   na tela pós-timer: um buraco a preencher lê como tarefa pendente.
3. **`live` / `liveSoft` são tokens do YPT** — "alguém está estudando agora".
   `DIRECAO-PRODUTO §6` tirou presença ao vivo da fundação. E **não existe token
   nenhum de prazo**, que é o motor novo.
4. **As telas de sala remapeiam os tokens, e erram o mapa.** Quatro arquivos
   declaram `const COLORS = {...}` hardcoded em dark. Em `feed/[id].tsx:25-40` e
   `league/[id].tsx:31-48`: `success: c.accent` (lime como sucesso),
   `surface: c.bg` (o card tem a cor da página), `border: c.surfaceRaised`, e
   `textSecondary`/`textMuted` **invertidos** em relação a `fgMuted`/`fgSubtle`.
   Não é hex na mão, mas fura a mesma regra por outra porta — e a inversão é a
   razão de o feed parecer sem hierarquia: o texto secundário está mais apagado
   que o terciário.
5. **Ninguém usa a paleta clara.** Todas as telas de sala importam `staticDark`.
   Dark-first virou dark-only.
6. **Três identidades convivem no repositório**, e nenhuma conversa com as
   outras — ver §5.
7. **O prazo não aparece em lugar nenhum**, e o placar usa `LeaderboardPodium`
   com ouro/prata/bronze: linguagem de ranking global permanente.
8. **A cor da matéria colore texto** (`subjectText`). `SUBJECT_COLORS` foi
   afinada para fundo escuro; como texto no claro, ela quebra contraste — o
   mesmo problema que o `colors.ts` já documenta sobre o lime.

---

## 3. A direção — o card do post

### 3.1 Uma correção minha, registrada

Na primeira leitura eu propus trocar o card cheio por uma **linha compacta** no
feed, importando a estrutura do GymRats. **Retirei a proposta.** O card cheio,
como o Pulso especificou em `FLUXO-TELAS-APP.md §8`, está certo:

- No GymRats a foto não carrega dado — ilustra um título. Na nossa, **a foto é a
  prova**. Prova em thumbnail de 56px não é "prova publicada no feed"
  (`DIRECAO-PRODUTO §1`), é prova arquivada.
- A lista compacta deles resolve um problema de densidade que nós não temos. Um
  grupo de 5–20 pessoas gera 4–8 posts por dia. Não há o que rolar.

Fica registrado porque é exatamente a armadilha que o CEO nomeou: copiar a
estrutura sem checar se o conteúdo é o mesmo. **O que se importa do GymRats não
é o formato do bloco — é a disciplina dentro dele.**

### 3.2 O card

Um número, quase nenhuma cor, nenhum bloco competindo, a foto fazendo o
trabalho. Da esquerda para a direita, de cima para baixo:

| # | Bloco | Regra |
|---|---|---|
| 1 | **ProofPhoto** | opcional · largura total · ~4:3 · `radius.lg`. Ausente = **o bloco não existe**. Nunca moldura vazia. |
| 2 | **Byline** | avatar 32 + nome (`text.bodyStrong`) + tempo relativo (`text.caption` / `c.fgMuted`). Uma linha. |
| 3 | **Subject** | ponto de 8px na cor da matéria + nome em `text.title3`. **A cor da matéria não colore o texto** — só o ponto. |
| 4 | **DataRow** | pills outline: `⏱ 47 min ✓` · `⚡ +120 XP`. Minutos sempre primeiro. |
| 5 | **Caption** | `text.body` / `c.fg` quando existe; linha-convite quando editável e vazia; ausente nos demais casos. |
| 6 | **ChallengeLine** | `text.caption` / `c.fgMuted` — "Conta para Sprint de Julho". Sem cor, sem pill, sem troféu: é contexto, não conquista. |

**O número herói é MINUTOS** — é a North Star (`ARCHITECTURE §1`) e é a prova do
que a pessoa fez. XP é a pontuação que nós calculamos; importa no placar, e o
placar é outra tela.

**Mas herói não significa grande.** O `pointsText` de hoje (22px, peso 800,
lime) some e vira pill. O card **não usa `text.display` nem `text.title1`** — a
escala grande pertence ao timer rodando, não ao post. Minutos ganha por ser o
primeiro pill e o único que pode subir de peso.

**Cor dentro do card: praticamente nenhuma.** O lime sai — hoje ele pinta o XP,
o avatar-placeholder e o botão de comentar. Fica reservado para o FAB de
publicar, o prazo do desafio quando aperta, e a linha do próprio usuário no
placar. Se pintarmos o card, a foto da prova deixa de ser o elemento mais forte
— e ela é o produto.

**Fora do card:** reações e comentários são chrome do feed. O card é o que o
servidor criou quando a sessão terminou; a camada social é o que os outros
fizeram depois, e envolve o card por fora. Consequência: a tela pós-timer não
monta rodapé social — num post de 2 segundos as contagens são sempre zero.

**Separadores de dia** entre os posts (`text.overline` / `c.fgMuted`):
HOJE / ONTEM / TER, 28 JAN. É o único elemento da lista compacta que sobrevive, e
é o que dá pulso a um feed com prazo.

### 3.3 Os estados

| Estado | Regra |
|---|---|
| esqueleto (~300ms) | só blocos de tamanho conhecido: avatar, duas barras, coluna do dado. **Nunca esqueleto para a foto** — não sabemos se existe, e um bloco grande que aparece e some é pior que nada. Sem shimmer: 300ms não paga animação. |
| sem foto | bloco ausente, card encurta, nenhum substituto |
| sem legenda | linha ausente no feed; linha-convite no pós-timer |
| sem reação | contagem zero = pill ausente. **Nunca "0 🔥".** |
| verificado | `✓` discreto em `c.success` colado ao pill de minutos — não é pill próprio |
| **não verificado** | **não mostra nada.** Sem selo cinza, sem "não verificado". Marcar o negativo é acusação, e num grupo de amigos que se conhecem isso envenena o feed. |

### 3.4 A tela pós-timer — o ponto onde a §3 vive ou morre

`DIRECAO-PRODUTO §3`: encerrar a sessão **cria** o post; publicar não é ato
separado. Na tela pós-timer o post **já está publicado**; legenda e foto são
enfeite opcional sobre algo que já existe. O backend pode estar certo e a
mecânica ainda morrer no visual. Um princípio governa tudo:

> **O card não muda de forma quando você adiciona legenda ou foto.**

Se adicionar legenda faz o card crescer, reorganizar ou preencher um buraco, o
estado sem legenda lê como incompleto — incompleto lê como pendente, e pendente
é formulário. **A ausência tem que parecer decisão, não vazio.** Daí:

- A legenda vazia **não é um input**: sem borda, sem fundo, sem moldura. É a
  própria linha de legenda do card, em `text.body` / `c.fgMuted`, com o texto
  "Adicionar uma legenda" — mesma posição e mesma métrica de uma legenda real.
  Toca e edita no lugar.
- Sem contador de caracteres. **Sem "(opcional)" escrito** — dizer "opcional" já
  admite que parecia obrigatório.
- "+ foto" é ação textual discreta, no peso de qualquer ação secundária. Nunca
  um *dropzone*.
- **Sem foco automático no teclado.** Teclado subindo sozinho é a definição de
  formulário aberto.
- **Nada de barra fixa no rodapé com botão primário grande** — é a assinatura
  visual de formulário.
- **Nenhum verbo no futuro ou imperativo:** "Publicar", "Concluir", "Finalizar".
  O cabeçalho afirma no passado: "Publicado em Sala X · agora".
- **Nenhum botão "Pular" ou "Agora não".** Pular só existe onde há etapa;
  oferecer pular *ensina* que havia algo a cumprir.
- **Card idêntico ao do feed. Sem estado "fresco"** — sem glow, sem borda de
  destaque, sem animação própria. Além do argumento do Pulso (o valor da tela é
  ver exatamente o que os amigos verão), um destaque que decai comunica "isto
  ainda é seu, ainda está acontecendo": a leitura de rascunho que precisamos
  evitar. **A comemoração mora na moldura** — cabeçalho e level-up — não no card.

### 3.5 O card do desafio

Fixo no topo do feed da sala, compacto e sem capa obrigatória. Ele responde a
três perguntas em uma passada: **qual é o desafio, quanto falta e onde estou**.

| Bloco | Regra |
|---|---|
| Estado | `text.overline` / `fgMuted`: "DESAFIO ATIVO". Não usa cor. |
| Nome | `text.title3` / `fg`. É o título do card. |
| Prazo | calmo = `text.label` / `fgMuted`, sem fundo; apertando = pill `deadlineSoft` + `deadline`; encerrado = passado em `fgMuted`. |
| Progresso | barra de 4–6px; trilho `surfacePressed`; preenchimento `deadline` apenas quando o prazo aperta. |
| Minha posição | "Você está em **#3 de 8**" em `fgMuted` + `fg`. Sem medalha e sem lime. |
| Métrica | valor secundário alinhado à direita: "47 min". A unidade vem do desafio. |

**Uma cor por superfície.** O primeiro teste visual colocou `deadline` laranja
e `#3 de 8` lime no mesmo card. Mesmo com contraste numérico correto, o conjunto
pareceu um semáforo. A posição, portanto, não usa lime aqui. O lime fica para a
linha do próprio usuário no placar; neste card, quando há urgência, a única cor
é `deadline`.

Sem desafio ativo, a mesma área vira uma chamada neutra: "Nenhum desafio
rolando" + ação "Criar desafio" em `accent`. Não se desenha um card vazio.

### 3.6 A linha do placar

O placar é uma lista única; o pódio sai por inteiro. Cada linha tem 64–72px e
quatro zonas estáveis:

| Zona | Regra |
|---|---|
| Avatar | 40px, sem aro de medalha. Placeholder usa superfície neutra. |
| Pessoa | nome em `text.bodyStrong`; "você" é texto, não badge. |
| Métrica | abaixo do nome em `text.label` / `fgMuted`: "347 min" ou a unidade definida pelo desafio. |
| Posição | alinhada à direita como ordinal: numeral em `text.title3`, `º` menor em `text.caption`, ambos em `fg`. Sem `#`. |

Empates usam ranking competitivo padrão: `1º, 2º, 2º, 4º`. O líder não recebe
coroa, ouro ou linha maior. A ordem já comunica quem lidera.

A linha do próprio usuário é a única que usa marca: fundo `accentSoft` e uma
barra de 3px em `accent` à esquerda. O texto continua em `fg`; não se pinta
posição nem métrica de lime. Assim, localizar-se é imediato sem criar uma
segunda hierarquia paralela à classificação.

---

## 4. Tokens

**Zero renomeações.** A interface `Palette` de `theme/colors.ts` é o vocabulário
e continua sendo. Evoluem valores e o que falta, não os nomes. As telas de sala
migram dos `const COLORS` hardcoded direto para ela, **uma vez só**.

Três chaves novas, todas em superfície nova — nenhuma existe nos blocos `COLORS`
atuais, então não causam segunda migração:

| Token | Para quê |
|---|---|
| `deadline`, `deadlineSoft` | o "faltam 3 dias" do card do desafio |
| `skeleton` | base do esqueleto de carregamento |

Rebaixados, sem sair da paleta: `live` / `liveSoft` (voltam na Fase 3, com
presença ao vivo) e `gold` / `silver` / `bronze` — a recomendação é o placar por
desafio **não** usar pódio. No GymRats a posição é tipografia: `1ˢᵗ`, numeral
bold, sufixo menor. Pódio é linguagem de ranking global permanente; num grupo de
8 com prazo, a pergunta é "quanto falta pro 1º".

Contraste continua sendo requisito, não gosto. `SUBJECT_COLORS` foi afinada para
fundo escuro e por isso **não colore texto** — só preenchimentos e pontos.

**Valores fechados na entrega 2:** `deadline` é `#FF8C3B` no escuro e `#A84C08`
no claro. `deadlineSoft` usa a mesma matiz a 16% no escuro e 14% no claro. O
teste visual lado a lado determinou a regra de não coabitar com lime dentro do
card do desafio; a auditoria automatizada confirma contraste de 6,17:1 no pill
escuro e 4,64:1 no claro.

`fgSubtle` fica restrito a detalhe desabilitado ou não textual (mínimo 3:1).
Timestamp e metadado que precisam ser lidos usam `fgMuted` (mínimo 4,5:1). Isso
preserva três níveis visuais sem fingir que texto de baixo contraste é acessível.

---

## 5. O mascote — a recomendação

Existem **dois** mascotes no repositório, e uma terceira identidade no ícone:

| Ativo | O que é | Onde é usado |
|---|---|---|
| `assets/quibear.png` | urso azul de boné, surfando | **em lugar nenhum** |
| `assets/mascot/castelo-*.svg` | castelo de tijolo marrom com bandeira lime — 30 estados × 2 paletas, 60 arquivos | **em lugar nenhum** |
| `assets/logo.png` = `icon.png` | grade azul de 9 quadrados com canto dobrado | tela de login; **e é o ícone que vai para a loja** |

Nenhum dos dois mascotes é referenciado por uma única linha de código. Só
`logo.png` e `quibly-text.png` aparecem, em `app/(auth)/login.tsx:240,257`. E o
ícone azul não tem relação nem com o urso, nem com o castelo, nem com o lime do
tema.

**Recomendação: o urso sai. O castelo fica. O castelo vira o ícone do app.**

**Por que o urso sai.** Azul contra um sistema lime, metáfora de surfe num app de
estudo, e concorre com o castelo. É manutenção de uma marca que não existe.
Deletar.

**Por que o castelo fica.** Tem argumento concreto, não sentimental: já é
lime-nativo (a bandeira é o `#C8FF4D`), já tem 30 estados desenhados nas duas
paletas, e **mascote não é ornamento neste gênero — o ícone do GymRats *é* o
mascote deles.** Mais importante: num app de prestação de contas entre amigos, o
mascote é o que faz "seu amigo viu que você não estudou" virar piada em vez de
culpa. Sem ele, o produto fica com uma cara de cobrança que o modelo não
aguenta.

**Mas o castelo não entra no card do post nem no placar.** Ali quem manda é a
foto da pessoa e o dado; mascote em superfície de dado é ruído. Ele vive em
estado vazio, fim de desafio, marco de sequência, onboarding, paywall e erro —
que é exatamente o que `assets/mascot/INDEX.md` já prescreve e que hoje não está
ligado em lugar nenhum.

**O ícone vira o castelo em silhueta chapada** sobre fundo de marca — a mesma
estratégia do rato do GymRats, que é uma forma sólida legível em 16px. A grade
azul é a coisa mais desalinhada do repositório e é a primeira impressão do
produto. *(Entrega 4. O nome, o bundle id e as fichas de loja não mudam.)*

**Implementação fechada:** silhueta near-black sobre campo lime no ícone
principal; inversão lime sobre near-black preservada como variante dark; marca
lime transparente no login; silhueta near-black transparente no adaptive icon,
com campo lime definido pela plataforma. A forma mantém castelo, ameias, porta
e bandeira e remove rosto, membros, tijolos, sombra e gradientes. Continua
legível no export de 16px. O wordmark `quibly-text.png` permanece: o símbolo
muda, o nome não.

**Ajuste de escopo:** ligar 8 estados e arquivar o resto. Sessenta arquivos
mantidos por causa de oito não se paga.

### 5.1 A capa padrão da sala

Formato fechado com o Pulso: **16:9**, sem texto embutido. Título da sala e a
faixa de três colunas vivem fora da imagem. O elemento essencial respeita o
safe crop central de 80% da largura × 80% da altura.

**Decisão: quatro variações determinísticas, não uma capa única.** Uma única
capa faria salas sem foto parecerem o mesmo grupo — ruim justamente num produto
de grupos pequenos e conhecidos. Trinta variações, por outro lado, transformam
estados emocionais em identidade aleatória e atribuem significados falsos
(`sad`, `sleepy`, `trophy`) à sala. Quatro é o ponto disciplinado: diversidade
visível sem loteria semântica.

As variações são neutras e derivam de ativos existentes: castelo-base,
`reading`, `focused` e `thinking`. Todas usam a silhueta lime aprovada sobre
fundo dark-first. `roomCoverForId(roomId)` aplica FNV-1a e escolhe sempre o mesmo
índice; a capa não muda entre aberturas.

Arquivos: `assets/room-covers/room-cover-castle-01.png` a `04.png`. A integração
importa apenas `assets/room-covers/index.ts`, que também exporta a proporção.

---

## 6. O que não copiamos do GymRats

- **O vermelho.** É a marca deles. O lime é a nossa e fica.
- **O claro-único.** Somos dark-first — as pessoas estudam de noite. E, como
  registrado em §1.1, eu **não sei** se eles têm modo escuro; nesta dimensão não
  existe referência para copiar.
- **A ausência total de número no feed.** Minutos é o nosso produto e sobe para
  o card.
- **A lista compacta.** Ver §3.1 — a foto deles ilustra, a nossa prova.

O pódio também sai, mas por razão nossa, não por imitação: grupo pequeno com
prazo.

---

## 7. Estado das entregas

| # | Entrega | Estado |
|---|---|---|
| 1 | Card do post no feed | direção definida (§3), alinhada com o Pulso; produção depende do `PostCard.tsx` único |
| 2 | Card do desafio | direção e tokens fechados (§3.5 e §4) |
| 3 | Linha do placar | direção fechada (§3.6); pódio aposentado |
| 4 | Ícone do app e logo | produzidos (§5); urso removido e wordmark preservado |
