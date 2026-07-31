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
dentro da mesma transação que pontua a sessão. A mecânica central está viva no
backend e invisível no app. O trabalho do mobile não é construí-la — é parar de
escondê-la.

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

Dois campos: **nome da sala** e **como você aparece**. Botão. Fim.
Depois: código + botão de compartilhar, que já funciona (`create.tsx:162`).

Morrem daqui, porque são configuração de **desafio** e não de sala: datas de
início e fim, durações rápidas de 7/30/90/365 dias, modo
easy/competitive/hardcore, e o slider de 2–100 membros. Some também
público/privado — a §6 é explícita, o modelo é grupo privado de gente que se
conhece, e um toggle "público" no app é uma promessa de descoberta que não
existe.

De 828 linhas sobram ~120.

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
9. **Level-up toca por cima do card e termina nele.** Hoje `LevelUpAnimation`
   chama `goHome()` (`active.tsx:323`) e joga o usuário na home — a comemoração
   enterra o post.
10. **Sessão varrida** (`abandoned_no_heartbeat`) também virou post. Na próxima
    abertura, a mesma tela como recap: "sua sessão de ontem foi publicada".

⚠️ **Depende do contrato:** a resposta do `end` precisa devolver o post criado
(id + sala). Sem isso a tela nasce com um spinner procurando no feed o post que
acabou de criar. Perguntas 1, 2, 3 e 5 ao Raiz.
⚠️ **Depende da Retina:** a estrutura do card.

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

Estrutura (hierarquia, estados, o que é prop) está sendo definida com a Retina.
**Não construir antes.**

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
