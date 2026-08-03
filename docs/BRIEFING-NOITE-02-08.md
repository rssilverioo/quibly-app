# Briefing — reformulação visual, noite de 02/08

> Escrito pelo CEO em 2026-08-02. **Este documento tem precedência sobre
> `MARCA.md §6` e sobre a linha "dark-first fica" de `DIRECAO-PRODUTO.md §7`.**
> Todo agente desta operação lê este arquivo antes de tocar em código.

---

## 1. A decisão do dono do produto

Perguntado até onde vai "o mais parecido possível do GymRats", com três opções na
mesa (estrutura-só / clone claro / clone com o vermelho deles), ele escolheu:

> **Clone visual completo — claro, como eles. O accent continua o azul do
> coelho. O vermelho deles não entra.**

O que isso revoga, explicitamente:

| Onde estava escrito | Estado |
|---|---|
| `theme/index.ts` — "Dark is the default and the designed-for mode" | **revogado** |
| `theme/colors.ts` — "The palette is dark-first" | **revogado** |
| `DIRECAO-PRODUTO.md §7` — "Dark-first fica" | **revogado** |
| `MARCA.md §6` — "O claro-único" na lista do que não copiamos | **revogado** |

O que **continua valendo, e ninguém reabre**:

| Decisão | Fonte |
|---|---|
| O accent é o azul `#4C9AFF`, amostrado do coelho | `colors.ts` |
| O mascote é o coelho | commit `8721a4c` |
| O vermelho do GymRats não entra em lugar nenhum | decisão de 02/08 |
| O nome, bundle id e fichas de loja não mudam | `DIRECAO-PRODUTO §7` |
| Mascote não entra em card de post nem em placar | `MARCA.md §5` |
| A arquitetura de tokens (`Palette` semântica, `useTheme()`) fica | `MARCA.md §4` |
| Tela nunca escreve hex na mão | `colors.ts` |

---

## 2. A regra que governa a noite

> **A referência é `docs/referencia/gymrats/`. Quando houver dúvida sobre
> tamanho, peso, ordem ou espaçamento, a resposta está numa das seis imagens —
> não na sua intuição.**

`real-play-store-feed.png` é a captura real do app rodando e vale mais que as
cinco da App Store. Elas são: `gr-en-14-challenge` (feed), `-workout` (detalhe do
post), `-team-up` (time), `-be-accountable` (placar), `-stay-motivated` (chat).

Três coisas que a referência ensina e que são fáceis de errar:

1. **Nenhum número grande em lugar nenhum.** Dado mora em pill outline de
   13–15px ou em número ~22px bold com label 13px cinza. Hierarquia vem de
   posição e exclusão, nunca de escala.
2. **Cor em quase nada.** No app deles o vermelho aparece em três lugares: o FAB,
   os links de ação e a barra de progresso. Aqui é o azul, nos mesmos três
   lugares, e mais nada. **A cor da tela são as fotos das pessoas.**
3. **Dois pesos de fonte.** Bold e regular. Escala curta. Títulos de tela ~28px
   alinhados à esquerda.

---

## 3. Restrições de operação — não negociáveis

- **Não criar pasta nenhuma fora de `/Users/rodrigosilverio/Code/quibly-app`.**
  Sem worktree, sem clone, sem repo novo, sem `/tmp` de trabalho persistente.
  Ordem direta do dono. (Motivo registrado em `PLANO-FECHAMENTO.md §5`: três
  worktrees encheram o disco e travaram uma sessão inteira.)
- **Cada agente só edita os arquivos do seu escopo** (§5). Precisou de mudança
  fora do escopo, **reporta ao CEO — não edita**. Vários agentes rodam ao mesmo
  tempo na mesma árvore; escopo é o que impede um sobrescrever o outro.
- **Credencial do dono nunca vira arquivo.** Token, cookie de sessão, chave de
  API, conteúdo de keychain ou de AsyncStorage do simulador: não se extrai, não
  se copia, não se escreve em lugar nenhum — **mesmo que isso destrave a
  tarefa.** Precisou de acesso autenticado, o caminho é pedir ao dono e parar.
  *(Escrito depois de um agente extrair o refresh token do Firebase do dono para
  um arquivo, na noite de 02/08. Estava proibido no briefing de outro agente e
  não neste — restrição que vale para todos pertence a este documento.)*
- **Não commitar e não fazer push.** O CEO consolida.
- **`npx tsc --noEmit` em `apps/mobile` tem que passar** antes de você declarar
  qualquer coisa pronta.
- Português nos comentários e nos textos de UI, seguindo o padrão do repositório.

---

## 4. Critério de pronto

Herdado de `PLANO-FECHAMENTO.md`: **nada é pronto porque foi escrito. É pronto
quando dá para ver funcionando.**

Na prática, para esta noite:

| Nível | O que exige |
|---|---|
| mínimo | `tsc --noEmit` passa e o arquivo não tem hex na mão nem `const COLORS` |
| bom | você abriu a referência do GymRats ao lado e a tela bate em ordem e densidade |
| pronto | há print da tela rodando, ou um motivo escrito de por que não deu |

E o erro com nome e endereço, de `PLANO-FECHAMENTO.md §Etapa 2`: `feed/[id].tsx`
já desenhou um retângulo cinza com ícone de câmera dizendo "prova enviada" **sem
nunca mostrar a foto**. A foto é o produto. Se o seu trabalho terminar com um
placeholder no lugar de uma imagem, ele não terminou.

---

## 5. Divisão de escopo

Quem edita o quê. Fora da coluna, ninguém encosta.

| Papel | Escopo exclusivo |
|---|---|
| **Tech Lead / Design System** | `apps/mobile/theme/**`, `apps/mobile/app/_layout.tsx`, `packages/shared/src/constants.ts`, `apps/mobile/package.json` |
| **Design Lead** | `docs/DESIGN-GYMRATS.md` (só escreve doc, não toca código) |
| **Eng. de Verificação** | `apps/mobile/scripts/**`, `scripts/**` — e prints. Não edita tela. |
| **Dev Componentes** | `apps/mobile/components/**` |
| **Dev Sala** | `apps/mobile/app/league/**` |
| **Dev Fora-da-Sala** | `apps/mobile/app/(tabs)/**`, `app/session/**`, `app/onboarding/**`, `app/(auth)/**`, `app/profile/**`, `app/pricing/**`, `app/lesson/**`, `app/flashcards/**`, `app/quizzes/**` |
| **QA** | não edita nada — lê, roda, reporta |

Dependência: Tech Lead e Design Lead entregam **antes** dos devs começarem. Os
tokens e o spec são a fundação; construir tela contra token que vai mudar é
retrabalho garantido.

---

## 6. Onde está o resto do contexto

| Pergunta | Documento |
|---|---|
| Por que o produto é assim | `DIRECAO-PRODUTO.md` |
| O que já foi decidido de visual, e por quê | `MARCA.md` |
| O que falta para o app funcionar de verdade | `PLANO-FECHAMENTO.md` |
| Que telas existem e o que cada uma faz | `FLUXO-TELAS-APP.md` |
| Como o backend está organizado | `ARCHITECTURE.md` |

Ao ler `MARCA.md` e `DIRECAO-PRODUTO.md`, lembre que a §1 deste briefing revoga
as linhas listadas lá. Todo o resto dos dois documentos continua de pé — em
particular a anatomia do card do post (`MARCA.md §3.2`), os estados (§3.3), a
tela pós-timer (§3.4), o card do desafio (§3.5) e a linha do placar (§3.6). Essa
parte foi especificada contra a referência real e **não** se reabre; o que muda é
que ela passa a ser desenhada sobre fundo claro.
