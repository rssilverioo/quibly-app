# Handoff — Pulso (mobile)

> Escrito em 2026-07-31, antes de uma troca de modelo. Para quem nunca viu a
> conversa anterior. **O desenho está em `docs/FLUXO-TELAS-APP.md`** — leia
> aquilo primeiro; este arquivo é só o que não cabe lá: estado de execução,
> decisões que ainda não viraram código, e o que está pendente de terceiros.
>
> Árvore: `/Users/rodrigosilverio/Code/quibly-pulso` · branch `f2/mobile-feed`.
> **Nunca dê `cd` nem `git checkout` em `~/Code/quibly-app`** — aquela árvore é
> da Peneira (QA). Os quatro agentes já se atropelaram lá uma vez.

---

## 1. Onde eu estou

Dois commits, ambos de documentação:

| Commit | O quê |
|---|---|
| `5ed3c44` | `FLUXO-TELAS-APP.md` — o fluxo de telas do loop social |
| (segundo) | fan-out N salas, atomicidade, estrutura do card |

**Código: zero.** Nenhum arquivo de tela foi tocado. Não há trabalho em
andamento não commitado — `git status` limpo fora do `DIRECAO-PRODUTO.md`
untracked, que é do CEO e não é meu para commitar.

O próximo passo estava prestes a começar quando a troca de motor chegou: é o
**item 1 do §11 do FLUXO-TELAS-APP.md**, e está **liberado** (ver §3 abaixo).

---

## 2. A migração dos `const COLORS` — o que fazer

### O problema

Quatro telas de sala declaram um bloco `const COLORS = {...}` no topo do
arquivo, remapeando `staticDark`/`legacyColors` na mão, e depois usam esse bloco
dentro de um `StyleSheet.create` de módulo:

- `apps/mobile/app/league/[id].tsx:30-48`
- `apps/mobile/app/league/create.tsx:28-46`
- `apps/mobile/app/league/feed/[id].tsx:25-40`
- `apps/mobile/app/league/join/[code].tsx:23-38`

Isso viola a `DIRECAO-PRODUTO.md §7` ("tela nunca escreve hex na mão") e, mais
concretamente: **enquanto esses blocos existirem, nenhum token novo da Retina
chega nessas telas.** É por isso que esta é a primeira entrega da fila.

### ⚠️ Não é troca mecânica — o mapa atual está ERRADO

A Retina auditou os blocos e achou cinco mapeamentos incorretos. **Não replique
o mapa existente ao migrar.** O mapa correto:

| Nome local hoje | Vai para | Observação |
|---|---|---|
| `background` | `c.bg` | ok |
| `surface` | `c.surface` | ⚠️ hoje é `c.bg` — por isso o card tem a cor da página e só se distingue pela borda |
| `surfaceLight` | `c.surfaceRaised` | ok |
| `border` | `c.border` | ⚠️ hoje é `c.surfaceRaised` |
| `primary` / `primaryLight` / `secondary` | `c.accent` | ok |
| `accent` | `c.danger` | ok (o nome local mente, o valor está certo) |
| `warning` | `c.warning` | ok |
| `success` | `c.success` | ⚠️ hoje é `c.accent` — lime sendo usado como sucesso |
| `error` | `c.danger` | ok |
| `text` | `c.fg` | ok |
| `textSecondary` | `c.fgMuted` | ⚠️ **INVERTIDO** hoje (está `c.fgSubtle`) |
| `textMuted` | `c.fgSubtle` | ⚠️ **INVERTIDO** hoje (está `c.fgMuted`) |
| `gold` / `silver` / `bronze` | `c.gold` / `c.silver` / `c.bronze` | ok |

Os dois invertidos são o diagnóstico mais valioso: **o texto secundário está
mais apagado que o terciário**, e é essa a razão de o feed parecer sem
hierarquia. Corrigir isso é metade do ganho visual da migração.

### Como migrar, mecanicamente

`useTheme()` é hook, e os estilos hoje são `StyleSheet.create` de módulo. O
caminho de menor diff — e o que eu ia usar — é uma fábrica:

```ts
const makeStyles = (c: Palette) => StyleSheet.create({ /* o mesmo conteúdo */ });

// dentro do componente:
const { c } = useTheme();
const styles = useMemo(() => makeStyles(c), [c]);
```

Isso preserva todas as definições de estilo e evita reescrever as telas para
arrays de estilo inline. Atenção: nesses arquivos há **vários componentes por
arquivo** (`LeaderboardRow`, `InfoTabContent`, `FeedPostCard`, `CommentItem`) —
cada um precisa do hook, não só o default export.

Referência de como o resto do app já faz: `apps/mobile/app/session/active.tsx`
usa `const { c } = useTheme()` e já está correto.

### Efeito colateral esperado — não silencie

Essas telas importam `staticDark`: dark-first virou **dark-only**. Ao passarem
por `useTheme()` elas vão responder à paleta clara **pela primeira vez**, e isso
vai revelar contraste quebrado. Ordem do CEO: **reporte o que aparecer, não
volte para `staticDark` para esconder.**

Um caso já conhecido, apontado pela Retina: a cor da matéria hoje colore o
*texto* do pill (`subjectText` em `feed/[id].tsx`), e as `SUBJECT_COLORS` foram
escolhidas para fundo escuro. No card novo a cor da matéria colore **só o ponto
de 8px**, nunca o texto.

### Escopo

Só os 4 arquivos acima. **Não** migrar `league/index.tsx` nem
`components/LeagueFeedTab.tsx`: os dois morrem (§10 do FLUXO-TELAS-APP.md), o
primeiro porque "Minhas Ligas" não existe no modelo novo, o segundo porque vira
o `PostCard`. Migrar código marcado para morrer é trabalho jogado fora.

PRs de ~400 linhas (regra do `CLAUDE.md`): um commit por arquivo.

---

## 3. A garantia que não pode ser quebrada

**Os nomes da `Palette` de `apps/mobile/theme/colors.ts` NÃO mudam.**

Confirmado pela Retina em `docs/MARCA.md §4` (commit `ecf0d6a`, branch
`brand/identidade`, árvore `~/Code/quibly-retina`): zero renomeações. `c.bg`,
`c.fg`, `c.fgMuted`, `c.fgSubtle`, `c.surface`, `c.surfaceRaised`, `c.border`,
`c.accent`, `c.accentSoft`, `c.success`, `c.warning`, `c.danger`, `c.scrim` —
todos ficam com o nome que têm. **Só os valores evoluem.**

É essa garantia que torna a migração segura hoje: trocar hardcode por
`useTheme()` é neutro ao valor, e a paleta nova entra sozinha depois, sem
ninguém encostar nas telas de novo.

Ela vai **acrescentar** três chaves: `deadline`, `deadlineSoft` (o "faltam 3
dias" do card do desafio) e `skeleton` (base do esqueleto de carregamento).
Nenhuma das três existe nos blocos `const COLORS` atuais — são adição pura em
superfície nova e não causam segunda migração.

O CEO decidiu explicitamente: **migra uma vez só.** Se alguém propuser renomear
tokens, isso quebra esta decisão e precisa voltar ao CEO.

---

## 4. Raiz (backend) — contrato fechado, nada pendente

O contrato saiu: `docs/API-ROOMS-CHALLENGES.md`, commit `0813b6d`, branch
`f2/rooms-contract`. Ainda sem push; leia pelo git compartilhado:

```
git show f2/rooms-contract:docs/API-ROOMS-CHALLENGES.md
```

Ele cobre os 10 pontos que pedi e **nada nele quebra o fluxo de telas**. Fechado
por ele e aceito por mim: fan-out fica (§1.3), apagar não estorna placar (§1.7),
`me.rank` dentro do objeto do desafio (§3.4), `metric_unit` pronto no payload,
`server_time` para o contador, criar sala = dois campos (§2.1), sem
retroatividade ao entrar numa sala (§2.6).

**Dois pedidos meus seguem sem resposta.** Os dois são de uma linha no contrato
e ficam caros depois do merge:

1. **`challenge_ends_at` no item de `posts[]` (§1.2).** O fan-out devolve N
   posts e a tela pós-timer tem um botão primário só ("Ver no feed"). Minha
   regra de destino é *a sala cujo desafio acaba primeiro*. Mas `posts[]` traz
   `challenge_id`/`challenge_title` e não traz prazo — sem esse campo eu faria N
   chamadas na tela mais crítica do app, ou usaria `posts[0]`, que é ordem de
   banco e não de relevância. **Alternativa aceita:** o Raiz garantir por
   contrato que `posts[]` já vem ordenado por relevância, e aí eu uso `posts[0]`.

2. **`publish_context` presente mesmo com `posts: []` (§1.2).** O contrato diz
   que sem sala nenhuma a tela "não abre" e vira convite. Divirjo, e a parte de
   UI é minha: a pessoa estudou 47 minutos de verdade, e trocar isso por um
   convite seco ensina que estudar sem sala não conta. Minha tela mostra o mesmo
   card com o dado real + "Nenhuma sala ainda" + uma ação. Para isso preciso de
   `minutes`, `subject`, `is_verified` e `proof_photo_url` mesmo com `posts`
   vazio. Pedi que ficasse **escrito** no contrato, porque é o tipo de campo que
   alguém "otimiza" depois sem saber que uma tela depende dele.

Uma resposta dele que já é decisão minha: **`show_proof_photo` default `true`**
quando há foto de proof aprovada. Eu tinha proposto `false` e **retirei** — "quando
o usuário deixa aparecer" é permissivo, e default `false` transformaria prova
publicada em prova arquivada. Não reabra isso.

⚠️ **Aviso de sincronia:** o `end` ainda **não** é atômico hoje
(`sessions.service.ts:637-657`, fora do `$transaction`). O Raiz vai corrigir
numa PR P0. Até lá, a tela pós-timer não pode assumir que o post existe só
porque a sessão encerrou — ela renderiza a partir do que o `end` devolver.

---

## 5. Pendente da Retina (marca)

Nada me bloqueia. Ela entregou a estrutura do `PostCard` (registrada no §8 do
`FLUXO-TELAS-APP.md`) e a decisão dos tokens (§3 acima). O que ela ainda deve:
os valores de `deadline`/`deadlineSoft`, que são superfície nova (card do
desafio) e não tocam a migração.

**Regra que continua valendo: não construir o `PostCard` sem falar com ela.** É
a superfície herói e vocês estão conectados via `maestri ask "Retina"`. O
racional completo está em `docs/MARCA.md §3.2` e `§3.4`, árvore
`~/Code/quibly-retina`.

---

## 6. O que NÃO fazer

- **Não abrir branch de implementação além do item 1.** Ordem do CEO: PostCard e
  o resto seguem esperando.
- **Não fazer push nem abrir PR** sem autorização do CEO.
- **Não tocar em `~/Code/quibly-app`.**
- **Não construir a tela pós-timer com um botão "Publicar".** Se a sua versão
  tiver um controle que o usuário possa deixar de apertar e por isso não
  publicar, a tarefa foi entendida errado — releia `DIRECAO-PRODUTO.md §3`.
  O post **já existe** quando aquela tela abre; ela confirma e enfeita, nunca
  decide.

---

## 7. O teste que julga o trabalho

`FLUXO-TELAS-APP.md §7`, item 8, é critério de aceite explícito:

> iniciar sessão → encerrar → **matar o app** pelo seletor antes de tocar em
> qualquer coisa → reabrir → **o post está no feed da sala, íntegro**.

Se falhar, a tela é um ato separado de publicar disfarçado, por mais bonita que
esteja.
