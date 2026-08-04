# Fluxo de telas — o loop GymRats no app

> Escrito em 2026-07-31 por Pulso (mobile). Implementa `DIRECAO-PRODUTO.md`,
> em especial a §3. **Papel, não código** — nenhuma branch de implementação
> aberta. Dois blocos ainda dependem de terceiros e estão marcados como tal:
> o contrato (Raiz, `API-ROOMS-CHALLENGES.md`) e a estrutura do PostCard
> (Retina). Nada aqui vira arquivo antes desses dois voltarem.

---

## 0. A regra que decide tudo

> **Terminar a sessão cria o post. O app nunca oferece a decisão de publicar.**

Todo desenho abaixo é subordinado a isso. O teste de qualquer tela nova:
*existe aqui algum controle que o usuário pode não apertar e, por não apertar,
não publicar?* Se existe, a tela está errada.

O servidor já cumpre a sua metade: `sessions.service.ts:649` cria o `FeedPost`
ao encerrar a sessão. A mecânica central está viva no backend e invisível no
app. O trabalho do mobile não é construí-la — é parar de escondê-la.

⚠️ **Mas não é atômico, e isso importa para esta tela.** O
`leagueMember.update` (o SP) e o `feedPost.create` (o post) são chamadas soltas
dentro de um `Promise.all`, sem `$transaction` (`sessions.service.ts:637-657`).
Se o `create` falhar, o SP já foi incrementado: **pontuou e não postou** — que é
exatamente o modo de falha que mata a §3, e hoje ele é silencioso. Correção
levantada pelo CEO e endereçada ao Raiz.

Consequência de tela enquanto isso não fecha: a tela pós-timer **não pode
assumir** que o post existe só porque a sessão encerrou. Ela renderiza a partir
do post que o `end` devolver; se não vier post, ela mostra o resumo da sessão e
um caminho de recuperação — nunca um card fantasma que finge que publicou.

---

## 1. O mapa

```
tab "Salas"
 └── /room/[id]                    o feed é a tela · card do desafio no topo
       ├── /room/[id]/challenge/[cid]   placar · prazo · métrica
       ├── /room/[id]/challenge/new     criar desafio (3 campos)
       ├── /room/[id]/chat
       └── /room/[id]/info              sheet: membros, convite, sair

/room/create                       criar sala (2 campos) → tela de convite
/join/[code]                       entrar por link → cai no feed

/session/active                    o timer (existe)
 └── /session/published            ← A PEÇA CENTRAL
```

Hoje a sala está enterrada em `profile → Minhas Ligas`
(`app/(tabs)/profile.tsx:254`). No modelo novo ela é destino de primeira classe:
tab própria, e com uma única sala o tab abre direto no feed dela — a lista só
aparece a partir da segunda.

---

## 2. Entrar por link — `/join/[code]`

Reaproveita `app/league/join/[code].tsx` quase inteiro; a estrutura está certa.

1. Abre o link → preview da sala: nome, quantas pessoas, desafio ativo e quanto
   falta para o prazo.
2. Um campo: como você quer aparecer. Pré-preenchido com o nome do perfil.
3. "Entrar" → **cai no feed da sala**.

O que muda em relação a hoje: o `Alert.alert` de sucesso
(`join/[code].tsx:89`) sai. Alerta de parabéns antes de mostrar o produto é uma
porta fechada na frente de quem acabou de aceitar um convite.

**Rota quebrada a consertar:** `league/index.tsx:59` empurra para
`/league/join` sem código — rota que não existe. Ou vira tela de digitar o
código, ou o botão sai. Prefiro tela de digitar: nem todo convite chega
clicável (print, áudio, ditado).

**Deep link:** `inviteUrl()` gera `tryquibly.com/join/CODE`, o `app.json` tem o
domínio associado, mas a rota do expo-router é `/league/join/[code]`. Precisa de
`+native-intent.ts` mapeando `/join/:code` → a rota interna, senão o link abre o
app e não vai a lugar nenhum. Verificar antes do lançamento.

---

## 3. O feed da sala — `/room/[id]`

**O feed é a tela.** Hoje é a aba 2 de 3 (`league/[id].tsx:301` abre no
placar). Inverte: quem entra na sala vê o que as pessoas fizeram, não uma tabela
de classificação. A tabela é consequência; o feed é o produto (§1: "Post — é o
produto").

```
┌────────────────────────────────────┐
│  Sala do Cursinho            ⋯     │  ⋯ → sheet de info
├────────────────────────────────────┤
│  ▸ Sprint de Julho · faltam 3 dias │  card do desafio (fixo no topo)
│    você está em #3 de 8            │  toca → placar
├────────────────────────────────────┤
│  [PostCard]                        │
│  [PostCard]                        │  ← mesmo componente da tela de publicar
│  [PostCard]                        │
└────────────────────────────────────┘
```

- **Sem desafio ativo:** o card vira convite — "nenhum desafio rolando · criar".
  Sala sem desafio é sala sem prazo, e prazo é o motor do modelo (§1).
- **Feed vazio:** não dizer "nenhum post ainda". Dizer o que produz um post:
  "ninguém estudou ainda hoje — comece uma sessão". O vazio é o melhor lugar
  para ensinar a mecânica.
- Info (membros, convite, sair) vira sheet a partir do `⋯`. Não merece aba.

---

## 4. O desafio e o placar — `/room/[id]/challenge/[cid]`

Topo: nome, prazo restante, métrica. Abaixo: pódio + lista.
`components/LeaderboardPodium.tsx` e o `LeaderboardRow` de `league/[id].tsx:68`
servem sem mudança estrutural.

Sai o seletor semanal/mensal/todo-o-tempo (`league/[id].tsx:294`): o placar é
**daquele desafio**, que já tem começo e fim próprios (§2 — "ranking daquele
desafio, não do universo"). Três períodos dentro de um evento com prazo é o
ranking contínuo do YPT sobrevivendo disfarçado.

Desafio encerrado: o placar congela e o topo declara quem ganhou. É o payoff do
prazo — hoje `league/[id].tsx:438` só mostra uma tarja "a liga terminou", que é
a informação sem a recompensa.

⚠️ **Depende do contrato:** unidade da métrica, e se "minha posição" vem no
objeto do desafio ou exige ler o placar inteiro (pergunta 8 ao Raiz). O card do
topo do feed é a coisa mais vista do app; não quero duas chamadas nele.

---

## 5. Criar sala — `/room/create`

~~Dois campos: **nome da sala** e **como você aparece**. Botão. Fim.~~
**Revisto em 2026-08-04 pelo dono do produto, depois de usar o app: são
quatro** — nome da sala, como você aparece, **modo** (foto/estudo) e
**duração** (7/14/30 dias).

Por quê: com dois campos a sala nascia sem desafio, e sem desafio
`isStudyChallenge` é falso — somem o botão do timer e a faixa de "estudando
agora". A sala nascia como um GymRats pior, e o que faltava só se conseguia por
um segundo passo que nenhuma tela pedia. O GymRats, que é a referência, resolve
tudo na criação do grupo.

Modo e duração **continuam sendo do desafio**; mudou onde se pergunta. A §6
segue valendo inteira — é por onde passa o próximo desafio, quando este
terminar.

Depois: código + botão de compartilhar, que já funciona (`create.tsx:162`).

Morrem daqui, e continuam mortos depois da revisão de 04/08: datas de início e
fim soltas, durações de 7/30/90/365 dias, modo easy/competitive/hardcore (que é
rigor de prova, outro eixo), e o slider de 2–100 membros. Some também
público/privado — a §6 é explícita, o modelo é grupo privado de gente que se
conhece, e um toggle "público" no app é uma promessa de descoberta que não
existe.

A régua de duração que voltou é 7/14/30, a mesma da §6, e não a de quatro
opções que morreu aqui.

De 828 linhas sobram ~200.

---

## 6. Criar desafio — `/room/[id]/challenge/new`

Três campos: nome, métrica, prazo (7 / 14 / 30 dias, ou data).
Ao criar, um post de sistema no feed anuncia — o desafio nasce visível para o
grupo, não como configuração silenciosa do dono.

É aqui que aterrissa o que saiu do criar-sala. O `DateTimePicker` e os botões
de duração rápida de `create.tsx:363` migram inteiros.

---

## 7. `/session/published` — a peça central

**Quando esta tela abre, o post já existe.** Ela não publica nada. Isso não é
detalhe de implementação: é o que faz a §3 ser verdade em vez de slogan. Não há
botão "Publicar" porque não há nada a publicar.

O segundo em que o usuário para o timer:

1. **Segurar "Encerrar" por 400ms**, com o anel do timer se preenchendo. Sai o
   `Alert.alert` de confirmação (`session/active.tsx:134`): um diálogo com
   "Cancelar" é exatamente uma porta de saída no instante em que não pode haver
   uma. O segurar protege do toque acidental sem oferecer a escolha de não
   publicar.
2. **A tela vira o card do post, já montado**, com o mesmo componente do feed.
   Números em esqueleto por ~300ms enquanto a resposta do `end` chega.
3. **No topo, no passado: "Publicado em Sala X · agora".** Não "publicar", não
   "quer publicar?". Já foi.
4. **O card:** minutos, matéria, +XP, foto da prova quando houver, e a
   atribuição ao desafio ativo.
5. **Dois enfeites opcionais, dentro do card:** legenda e "+ foto". Sem foco
   automático no teclado — é um campo, não uma etapa. Quem não toca em nada já
   publicou.
6. **Um botão primário: "Ver no feed"** → `/room/[id]` com o post no topo.
7. **Uma saída, pequena e textual: "Apagar post".** A válvula de escape do
   GymRats. Destrutiva, discreta, e um `DELETE` — nunca um "publicar" invertido.
8. **Matar o app aqui não desfaz nada.** É o teste da §3: se fechar o app na
   tela de publicar perde o post, a tela é um ato separado disfarçado.
   **Critério de aceite explícito, e o primeiro a rodar em qualquer revisão
   desta tela:** iniciar sessão → encerrar → matar o app pelo seletor antes de
   tocar em qualquer coisa → reabrir → o post está no feed da sala, íntegro.
   Se falhar, a tela está errada, por mais bonita que esteja.
9. **Level-up toca por cima do card e termina nele.** Hoje `LevelUpAnimation`
   chama `goHome()` (`active.tsx:323`) e joga o usuário na home — a comemoração
   enterra o post.
10. **Sessão varrida** (`abandoned_no_heartbeat`) também virou post. Na próxima
    abertura, a mesma tela como recap: "sua sessão de ontem foi publicada".

⚠️ **Depende do contrato:** a resposta do `end` precisa devolver o post criado
(id + sala). Sem isso a tela nasce com um spinner procurando no feed o post que
acabou de criar. Perguntas 1, 2, 3 e 5 ao Raiz.

---

## 7.1 Uma sessão, N salas — o fan-out

**Decidido pelo CEO em 2026-07-31: o fan-out fica.** `sessions.service.ts:637`
replica o post em toda sala em que o usuário é membro, e isso é o comportamento
certo — a sessão é o registro de estudo *da pessoa*, não pertence a um grupo só.

A consequência é minha: o cabeçalho da §7 está no singular e a tela precisa
dizer a verdade quando forem três salas. Como resolve:

**Uma sala** — "Publicado em Sala do Cursinho · agora". Como escrito na §7.

**N salas** — "Publicado em 3 salas · agora", e abaixo uma fileira de chips com
os nomes. Cada chip carrega a atribuição daquela sala quando houver
("Cursinho · Sprint de Julho"), porque o desafio é por sala e o card é um só.
Tocar num chip vai para o feed daquela sala.

O chip é o lugar onde o fan-out fica *legível* sem virar decisão: ele informa
onde o post caiu, depois de ele já ter caído. Em nenhum momento a tela oferece
escolher salas **antes** — seleção prévia é o ato separado de publicar voltando
pela porta dos fundos, com outro nome.

**"Ver no feed" com N salas.** Um botão, um destino: a sala com desafio ativo de
prazo mais próximo; sem desafio em nenhuma, a de atividade mais recente. É a
sala onde o post tem mais chance de ser visto hoje. As outras seguem a um toque
pelos chips.

**Apagar com N salas.** Um gesto apaga em todas — é uma sessão e um
arrependimento só, e obrigar a pessoa a apagar três vezes é punir quem já
decidiu. Para o caso real de querer sair de *uma* sala (o post de estudo que faz
sentido no grupo do cursinho e não no da família), cada chip tem um `×`
discreto: remove daquela sala e mantém nas outras.

**Legenda e foto editam todas as cópias.** É uma sessão replicada, não três
posts independentes. Legenda por sala seria escrever três posts — exatamente o
trabalho que a §3 existe para eliminar.

**Zero salas — o buraco que nem o doc nem o código cobriam.** Sem sala,
`userLeagueMembers` é vazio, nenhum `FeedPost` é criado, e a mecânica central
simplesmente não acontece. Hoje isso é silencioso. A tela passa a mostrar o
mesmo card (a sessão foi real, o dado é real) com o cabeçalho "Nenhuma sala
ainda" e uma única ação: criar sala ou entrar por link.

❓ **Pergunta aberta, não decidida por mim:** ao entrar na primeira sala, as
sessões recentes viram post retroativamente? Sem isso, quem estuda antes de ter
grupo entra na sala com o feed vazio e sem prova do que já fez — e o primeiro
dia é onde a §3 mais precisa aparecer. É pergunta de produto e de contrato,
levo ao CEO e ao Raiz antes de desenhar qualquer coisa.

⚠️ **Depende da Retina:** a estrutura do card. *(respondida — ver §8)*

---

## 8. O PostCard

Um componente, dois contextos: leitura (feed, post dos outros) e recém-criado
(pós-timer, post do autor, editável). **Não podem ser dois componentes** — se
divergirem, o post deixa de ser o mesmo objeto nos dois lugares e a §3 morre por
dentro, silenciosamente.

Hoje já divergiram: `app/league/feed/[id].tsx` (933 linhas) e
`components/LeagueFeedTab.tsx` (~500) são o mesmo card escrito duas vezes, com
`FirebaseFeedPost`, `timeAgo` e `getInitials` copiados em ambos. Viram
`components/feed/PostCard.tsx`.

**Estrutura fechada com a Retina em 2026-07-31.** Ela registra o racional em
`docs/MARCA.md` na árvore dela; aqui fica o que eu codo.

```
1. ProofPhoto      opcional · largura total · ~4:3 · radius.lg
                   sem foto = o bloco NÃO EXISTE (nada de área tracejada)
2. Byline          avatar 32 + nome (text.bodyStrong) + tempo relativo
3. Subject         ponto 8px na cor da matéria + nome em text.title3
                   ⚠ a cor da matéria colore o PONTO, nunca o texto
4. DataRow         pills outline: [⏱ 47 min ✓] [⚡ +120 XP] · minutos sempre 1º
5. Caption         text.body quando existe · linha-convite quando editable e
                   vazia · ausente quando nenhuma das duas
6. ChallengeLine   text.caption/c.fgSubtle · "Conta para Sprint de Julho"
```

Props: `post`, `editable?`, `loading?`, `onEditCaption?`, `onAddPhoto?`.
**Reações e comentários não são props do card** — são chrome do feed
(`<PostSocialFooter/>`), porque o card é o que o *servidor criou quando a sessão
terminou* e a camada social é o que os *outros* fizeram depois. Consequência
direta para a §7: a tela pós-timer monta só `<PostCard/>`. Num post de dois
segundos as contagens são sempre zero, e uma fileira zerada logo abaixo da
comemoração é anticlímax.

As decisões dela que eu não teria tomado sozinho, e que mudam o que eu ia
escrever:

- **Nenhuma diferença visual entre as duas variantes.** Sem glow, sem borda de
  destaque, sem estado "fresco". O motivo é melhor que o meu: um destaque que
  decai comunica "isto ainda é seu, ainda está acontecendo" — que é a leitura de
  **rascunho**, exatamente o que a §3 não pode permitir. O card tem que parecer
  terminado desde o primeiro frame. A comemoração mora na moldura (cabeçalho e
  level-up), não no card.
- **Minutos é o herói, mas herói não quer dizer grande.** O `pointsText` de hoje
  (22px, peso 800, lime) vira pill de 13–15px. Hierarquia por posição e
  exclusão, não por escala — no GymRats não existe um número grande sequer.
- **Não verificado não mostra nada.** Sem selo cinza, sem "não verificado".
  Marcar o negativo é acusação, e num grupo de 8 amigos isso envenena o feed.
  Verificado é um `✓` colado no pill de minutos, não um pill próprio.
- **Sem esqueleto para a foto da prova** — não sabemos se ela existe, e um bloco
  grande que aparece e some é pior que nada.
- **O lime sai do card.** Fica para o FAB, o prazo apertando e a sua linha no
  placar. No GymRats a cor da tela são as fotos das pessoas; pintar o chrome
  rouba da foto, e a foto é o produto.

Ela também retirou uma proposta própria (trocar o card cheio pela linha compacta
do GymRats), com o argumento certo: lá a foto ilustra, aqui a foto **é a prova**
— prova em thumbnail de 56px é prova arquivada, não prova publicada.

O que ela pediu e é chrome do feed, não do card: separadores de dia
(HOJE / ONTEM / TER, 28 JAN) em `text.overline` + `c.fgSubtle`.

O que **não pode existir** na tela pós-timer, e vale como checklist de revisão:
barra fixa no rodapé com botão primário grande (assinatura de formulário);
qualquer verbo no futuro ou imperativo ("Publicar", "Concluir", "Finalizar");
botão "Pular" ou "Agora não" — pular só existe onde há etapa, e oferecer pular
**ensina** que havia algo a cumprir.

---

## 9. Métrica

A §8 pede **% de sessões encerradas que viram post**. Com este desenho o número
é 100% por construção, menos os apagamentos — o que é o ponto, não um truque: se
publicar não é um ato, não há como falhar em publicar.

Os números que passam a diagnosticar de verdade:

| Evento | O que revela |
|---|---|
| `post_deleted` / sessões | arrependimento — o único jeito de a §3 falhar agora |
| `post_caption_added` | o post virou expressão ou continua sendo recibo |
| `post_screen_dismissed` sem ver o feed | a tela vira pedágio em vez de recompensa |

---

## 10. O que morre em `apps/mobile/app/league/`

| Alvo | Por quê |
|---|---|
| `league/index.tsx` (144) | "Minhas Ligas" não existe no modelo novo; sala é tab. Contém link morto para `/league/join`. |
| as 3 abas de `league/[id].tsx` | sala abre no feed; info vira sheet; placar vira tela do desafio |
| ~700 das 828 linhas de `create.tsx` | datas, modo, privacidade, limite de membros — tudo é desafio, não sala |
| a duplicação do card (933 + ~500) | vira `components/feed/PostCard.tsx` |
| `const COLORS = {...}` nos 4 arquivos | remapeiam `staticDark`/`legacyColors` à mão. A §7 já proíbe ("tela nunca escreve hex na mão") e enquanto existirem nenhum token da Retina chega nessas telas. Tudo por `useTheme()`, que `active.tsx` já usa. |
| filtro semanal/mensal/all-time | o desafio já tem prazo próprio |
| "prova enviada" com ícone de câmera (`feed/[id].tsx:381`) | a §3 pede a foto; hoje a foto nunca aparece. Reescrever. |
| `handleRematch` → `/league/create` | vira "novo desafio nesta sala" |
| `Alert.alert` de encerrar (`active.tsx:134`) | a porta de saída no pior momento possível |
| `interface FirebaseFeedPost` ×2 | tipo do `@quibly/shared` |

---

## 11. Ordem de entrega

PRs pequenos, um por linha, nesta ordem:

1. `useTheme()` nas 4 telas de sala — pré-requisito de todo o resto e do
   trabalho da Retina. Não depende de contrato. **Segurado por decisão do CEO
   até a Retina dizer os nomes dos tokens: migra uma vez só, no vocabulário
   novo.**
2. `PostCard.tsx` único, substituindo as duas cópias. Depende da Retina.
3. `/session/published`. Depende do contrato (1, 2, 3, 5) e do PostCard.
4. Feed como tela da sala + card do desafio no topo.
5. Criar sala enxuto + criar desafio.
6. Placar do desafio.
7. `/join` com código digitado + `+native-intent`.

Com o item 1 segurado, **nada começa antes do contrato (Raiz) ou da estrutura
do card (Retina)**. Isso é de propósito: o custo de esperar é uma tarde, o custo
de construir o PostCard duas vezes é a §3 divergindo em silêncio.
