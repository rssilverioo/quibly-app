# Direção de produto — o loop social

> ⚠️ **A §7 (Identidade visual) foi parcialmente revogada em 2026-08-02** por
> `BRIEFING-NOITE-02-08.md`. Duas das três linhas da tabela de decisões caíram:
> o accent **não é mais o lime** (virou o azul `#4C9AFF` do coelho, 2026-07-31)
> e **dark-first virou light-first** (2026-08-02, clone visual claro do GymRats).
> O mascote também deixou de ser o castelo. **As §§1–6 e §8 — o produto, a
> mecânica e a métrica — continuam integralmente válidas** e são o que importa
> nesta página.

> Escrito em 2026-07-31. **Este documento tem precedência sobre a ênfase da
> Fase 2 do `ROADMAP.md`.** A arquitetura de `ARCHITECTURE.md §4` continua
> válida — o que muda é o que é protagonista.

---

## 1. A decisão

**Quibly é o GymRats do estudo.**

Não é o YPT. A diferença não é cosmética, é de eixo:

| | YPT (o que o roadmap assumia) | GymRats (o que vamos construir) |
|---|---|---|
| Unidade | a **sala** permanente | o **desafio** com prazo |
| Motor | presença ao vivo — quem está estudando agora | prova publicada — o que você fez hoje |
| Pressão | ranking contínuo, infinito | deadline; o desafio acaba e alguém ganha |
| Grupo | público, milhares de estranhos | privado, 5–20 pessoas que se conhecem |
| Post | não existe | **é o produto** |

O YPT retém por vigilância passiva. O GymRats retém por **prestação de contas
entre pessoas que se conhecem, com prazo**. O segundo é mais forte, mais barato
de construir e não exige massa crítica para funcionar: um grupo de 6 amigos já
é um produto completo no dia 1. Uma sala pública com 3 desconhecidos não é.

**Consequência direta:** paramos de perseguir presença ao vivo por WebSocket
como pré-requisito. Ela vira melhoria da Fase 3, não fundação.

---

## 2. A hierarquia

```
Sala (Room)          permanente · o grupo · invite code · membros · chat · feed
 └── Desafio         evento com prazo e métrica · vários, em sequência
       └── Placar    ranking daquele desafio, não do universo
 
Post                 a sessão de estudo publicada no feed da sala
```

Isto é exatamente o `ARCHITECTURE.md §4` — a sala permanente com desafios
dentro. O que muda é a ordem de construção: **o desafio e o post vêm primeiro**,
a sala é o container que os segura.

Migração dos dados atuais: cada `League` de hoje vira uma `Room` + um `Challenge`
já concluído dentro dela. Ninguém perde histórico.

---

## 3. A mecânica central — não negociável

> **Terminar uma sessão de estudo cria um post no feed da sala.**

É a única linha deste documento que, se for entregue errada, invalida tudo o
resto. No GymRats você não "escreve um post" — você registra o treino e o post
acontece. O atrito de publicar é zero porque publicar não é um ato separado.

O post carrega **dado real, calculado no servidor**:

| No card do post | De onde vem |
|---|---|
| minutos estudados | `StudySession` — duração calculada no servidor (Fase 1) |
| matéria / tópicos | `SessionTopic` (Fase 1) |
| XP ganho | scoring existente |
| foto da prova | `ProofCheck.photoUrl`, quando o usuário deixa aparecer |
| legenda | opcional, escrita pelo usuário |

Por que insisto no "calculado no servidor": um placar que dá para burlar não é
placar. A Fase 1 já resolveu isso — o post herda essa garantia de graça. É por
isso que a sequência das fases estava certa mesmo com a ênfase errada.

**Post avulso também existe** (foto + legenda, sem sessão). É a válvula de
escape do GymRats e o que mantém o feed vivo em dia de pouco estudo. Hoje
`FeedPost.sessionId` é obrigatório — precisa virar opcional.

---

## 4. O que o schema já nos dá

Boa parte do GymRats já está no banco. Não vamos reconstruir:

| Já existe | Papel no novo modelo |
|---|---|
| `League` (com `startDate`/`endDate`/`status`) | **é o desafio** — só precisa mudar de nome e de lugar |
| `LeagueMember` com `totalSp`/`weeklySp` | placar |
| `FeedPost` ligado a `StudySession` + `showProofPhoto` | **a mecânica da §3 já está esboçada** |
| `FeedReaction`, `FeedComment` | curtida e comentário |
| `ChatMessage` | chat da sala |
| `ProofCheck` com `photoUrl` | a foto |
| `inviteCode` | convite |

O que falta é menos do que parece: separar sala de desafio, tornar o post
independente da sessão, dar métrica ao desafio e construir as telas.

---

## 5. As três frentes

| Frente | Escopo | Dono |
|---|---|---|
| **Domínio** | `League` → `Room` + `Challenge`; métrica e placar por desafio; `FeedPost` sem sessão obrigatória; convite por link | backend |
| **App** | feed da sala, criar sala, criar desafio, entrar por link, card do desafio, placar, e **a tela de publicar ao encerrar a sessão** | mobile |
| **Qualidade** | teste de scoring e de placar, revisão dos PRs, guardar a migração dos dados existentes | QA |

A ordem importa: o contrato da API sai antes das telas. Mobile não espera o
backend terminar — espera o contrato, que é a primeira entrega do domínio.

---

## 6. O que fica de fora agora, e por quê

**Presença ao vivo.** ~~Adiada.~~ **REVERTIDO em 2026-07-31 pelo dono do
produto, e a correção é dele:** a presença ao vivo é *a* diferença deliberada
entre nós e o GymRats. Não é um extra do YPT que sobrou — é a única coisa que
mudamos de propósito.

A frase que fecha o produto:

> **Igualzinho ao GymRats. A única diferença é que a sala mostra quem está
> estudando agora.**

Ou seja, dentro da sala existem **duas portas**, e as duas produzem post:

| Porta | O que acontece |
|---|---|
| **Postar a foto** | direto, como o GymRats. Foto + legenda vão para o feed |
| **Ligar o timer** | pomodoro/cronômetro. Enquanto roda, **você aparece na sala como estudando agora**; ao encerrar, vira post com minutos, matéria e XP |

A presença ao vivo não é uma tela separada nem um ranking paralelo — ela mora
**dentro da sala**, no topo do feed: quem está estudando neste momento. É o
gatilho que o feed assíncrono sozinho não dá.

### Refinamento de 2026-07-31: o timer é um MODO, não uma mudança global

Correção posterior do dono do produto, e ela é a que fecha o desenho:

> **100% fiel ao GymRats. O estudo por pomodoro vira um modo do desafio.**

Ou seja, não espalhamos timer e presença por todo o app. O GymRats permanece
intacto como base, e o pomodoro é uma **opção do desafio**, escolhida na
criação:

| Modo | Como se registra | Presença ao vivo |
|---|---|---|
| **Foto** (padrão) | tira a foto e posta — GymRats puro | não |
| **Estudo** | liga o pomodoro; ao encerrar vira post com minutos, matéria e XP | **sim** — a sala mostra quem está estudando agora |

Por que isto é melhor do que ter as duas portas sempre visíveis: um grupo que
quer só a prestação de contas por foto não carrega uma interface de timer que
não usa, e um grupo de cursinho liga o modo estudo e ganha a sala ao vivo. A
escolha acontece uma vez, na criação do desafio, e a sala inteira se adapta.

**A presença ao vivo só existe no modo estudo.** No modo foto, a sala é
exatamente o GymRats — sem faixa de "estudando agora", porque não há timer para
alimentá-la.

Nota de implementação: `League.mode` já existe no schema hoje
(`easy | competitive | hardcore`), mas é outro eixo — trata de rigor de prova.
Este é um eixo novo e precisa de campo próprio; não sobrecarregue o existente.

**Descoberta de salas públicas.** O modelo é grupo privado de gente que se
conhece. Diretório público é problema de quem já tem massa.

**Ranking global por track.** Mesma razão. O placar que importa é o dos seus 8
amigos, não o do país.

Nada disso está morto — está atrás de uma evidência que ainda não temos.

---

## 7. Identidade visual

Decidido em 2026-07-31, junto com o giro de produto.

**O nome continua Quibly.** Não há troca de nome, e nada de loja — bundle ID,
App Store Connect, Play Console, deep links, convites em circulação — entra
neste escopo. Trocar nome é operação irreversível de distribuição; trocar
identidade é trabalho de app, reversível. Fazemos o segundo.

**A referência visual é o GymRats.** Direta, não "inspirada em".

Com dois limites que valem tanto quanto a referência:

1. **É sobre clareza e estrutura, não sobre clonar pixel.** Copiar a cara deles
   literalmente nos transforma num clone sem marca — e o nome na loja continua
   sendo o nosso.
2. **O dado do nosso card é outro.** Minutos estudados, matéria, tópico, XP,
   foto da prova — não repetição, distância e caloria. A estrutura deles é o
   ponto de partida; o conteúdo é nosso, e conteúdo diferente muda hierarquia.

**Não é rebranding do zero.** `apps/mobile/theme/colors.ts` e `tokens.ts` já
são uma base boa: tokens semânticos, dark-first, escala tipográfica curta, e a
regra de que tela nunca escreve hex na mão. **A arquitetura fica. Os valores
evoluem.** Qualquer proposta que comece por "vamos refazer o design system"
está respondendo à pergunta errada.

A superfície herói é o **card do post no feed** — a mesma peça da §3. Desenha-se
ela primeiro; card do desafio, linha do placar, ícone e logo derivam dela.

### Decidido pelo dono do produto em 2026-07-31

As três perguntas em que "igual ao GymRats" não tinha resposta óbvia foram
levadas e respondidas. Detalhamento e argumento em `MARCA.md`.

| Pergunta | Decisão | Razão |
|---|---|---|
| Vermelho deles ou lime nosso? | **Lime fica** | O vermelho é a marca *deles*. Copiar a cor nos torna cópia sem marca própria. Importamos a disciplina — quase nenhuma cor no chrome, a cor vem das fotos — não o pigmento. |
| Claro deles ou dark nosso? | **Dark-first fica** | As pessoas estudam de noite, razão já escrita em `colors.ts`. E não sabemos se o GymRats tem modo escuro (`MARCA.md §1.1`): aqui não existe referência para copiar. |
| Ícone: grade azul atual? | **Castelo em silhueta** | O urso sai — não é referenciado por nenhuma linha de código e é azul contra um sistema lime. O castelo é lime-nativo e tem 30 estados prontos. Silhueta chapada é a estratégia do rato do GymRats: legível em 16px. |

**O nome, o bundle ID e as fichas de loja não mudam** — trocar o ícone não é
trocar a identidade de distribuição.

Limite que continua valendo sobre o mascote: ele **não entra no card do post nem
no placar**. Ali mandam a foto da pessoa e o dado; mascote em superfície de dado
é ruído. Ele vive em estado vazio, fim de desafio, marco de sequência,
onboarding e erro.

---

## 8. Como sabemos que deu certo

A North Star continua sendo **minutos de estudo verificado por usuário por
semana** (`ARCHITECTURE.md §1`). Mas para este loop, a métrica de diagnóstico é:

> **% de sessões encerradas que viram post publicado.**

Se for baixa, o atrito da §3 não foi eliminado e o resto não vai funcionar.
É o primeiro número que quero ver depois do lançamento.
