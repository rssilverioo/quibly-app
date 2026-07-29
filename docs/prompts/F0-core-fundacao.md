# [SQUAD CORE · FASE 0] Fundação: CI, testes, segurança e controle de custo

Você é o tech lead de backend do Quibly, um app de estudo (Expo + NestJS +
Prisma + Postgres, monorepo Turbo). O produto vai passar por uma reformulação
total. Sua tarefa é a **Fase 0**: pagar a dívida que impede qualquer trabalho
seguro depois. Nada aqui aparece na tela do usuário — e tudo aqui é bloqueante.

**Leia primeiro:** `docs/ARCHITECTURE.md` (§5 e §3) e `docs/ROADMAP.md` (Fase 0).

Branch: `f0/core-fundacao`. Quebre em PRs pequenos, um por bloco abaixo.

---

## Bloco 1 — CI e testes (🔴 bloqueante)

Hoje o repo tem **zero testes e zero CI** com 27k linhas e compra in-app em
produção. Isso acaba nesta tarefa.

- GitHub Actions rodando em todo PR: `lint`, `typecheck`, `test`, `prisma validate`
- Escolha o runner de teste (Jest já vem com o NestJS; Vitest é opção para o shared) — decida e justifique no PR
- Suíte inicial, cobrindo o que quebra dinheiro ou ranking:
  - `packages/shared/src/scoring.ts` — todos os multiplicadores, incluindo o teto de streak
  - `packages/shared/src/constants.ts` — `levelFromXp` / `xpForLevel` (ida e volta), `calculateTitle` (ordem das regras importa), `proofChecksForDuration` (limites)
  - `apps/api/src/usage/usage.service.ts` — cota por plano, incluindo o caso `Infinity`
  - `apps/api/src/leagues/leagues.service.ts` — entrar em liga cheia, entrar duas vezes, código inválido
  - `apps/api/src/sessions/sessions.service.ts` — cálculo de duração e pontos

Não persiga cobertura alta. Persiga os caminhos onde um erro custa dinheiro,
corrompe ranking ou trava o usuário.

## Bloco 2 — Segurança da API (🔴 bloqueante)

- `apps/api/src/main.ts:11` — `app.enableCors()` está aberto para qualquer
  origem. Trocar por allowlist explícita via env (`CORS_ORIGINS`).
- Adicionar `helmet`.
- `@nestjs/throttler` global. **Além disso**, limites bem mais apertados nas
  rotas que chamam LLM: `generate/*`, `lessons/capture`, `lessons/ask`,
  `audio-sessions/*`. Hoje só existe cota diária por plano em `generate` —
  as outras rotas de IA não têm nenhuma proteção e cada request custa dinheiro.
- `apps/api/src/leagues/leagues.service.ts:25-33` — `generateInviteCode` usa
  `Math.random()` e não trata colisão: o `@unique` estoura 500 em vez de gerar
  outro código. Trocar por `crypto.randomBytes` + retry com limite de tentativas.

## Bloco 3 — Entitlements (🔴 bloqueante para o lançamento grátis)

Decisão de produto: **lançamos de graça** para captar usuários, e ligamos os
limites depois. Para que "depois" não signifique um refactor, a camada precisa
existir agora, com tudo liberado.

- `EntitlementService` que resolve limites por usuário a partir do plano
- Substitui a leitura direta de `USAGE_LIMITS` em `usage.service.ts` e `generate.service.ts`
- Limites vêm de configuração (tabela `Entitlement` ou config versionada) — mudar limite **não pode exigir deploy**
- **Estado inicial: tudo liberado.** Todos os limites em `Infinity` para FREE.
- Deixe testado o caminho de "limite ativo", mesmo desligado — é o que vamos ligar na Fase 7

## Bloco 4 — Controle de custo de IA (🔴)

Grátis + LLM = queima de caixa proporcional ao sucesso. Precisamos de freio
antes de abrir a torneira.

- Tabela `AiUsageLedger`: usuário, dia, tarefa, modelo, tokens de entrada/saída, custo estimado
- `AiRouter` entre os serviços de domínio e `OpenaiService`/`GeminiService`:
  - escolhe o modelo pela tarefa (transcrição ≠ geração de quiz ≠ resumo)
  - debita de um orçamento diário de tokens por usuário
  - registra tudo no ledger
- Generalizar o cache: `AudioClip.textHash` já cacheia TTS por hash do texto —
  esse é o padrão certo, aplique à geração de conteúdo determinística
- Endpoint de admin mostrando custo por usuário e por dia

## Bloco 5 — Observabilidade e banco (🟠)

- Sentry na API e no mobile; logger estruturado no lugar de `console.log`
  (há `console.log` de payload de ofertas em `apps/mobile/hooks/useIAP.ts` — remova)
- **Banco compartilhado:** o schema tem `@@map("captured_lessons")` com o
  comentário de que a tabela `lessons` pertence a *outro produto* no mesmo
  Postgres de produção. Enquanto isso for verdade, uma migration nossa pode
  derrubar o vizinho. Levante o risco real (quais tabelas são compartilhadas,
  quem mais escreve nelas) e **proponha** o plano de separação — schema
  dedicado ou instância própria. **Não execute a separação sem aprovação.**

---

## Pronto quando

- [ ] PR não passa sem lint, typecheck, testes e `prisma validate` verdes
- [ ] CORS fechado, helmet ativo, throttler global + limites de IA por rota
- [ ] Código de convite criptográfico com retry, coberto por teste
- [ ] `EntitlementService` em produção com tudo liberado, caminho de limite testado
- [ ] `AiRouter` + ledger registrando custo real, com orçamento por usuário
- [ ] Sentry recebendo erro de API e de mobile
- [ ] Documento com o risco do banco compartilhado e o plano proposto

## Não faça

- Não mexa em UI
- Não mude regra de scoring — só cubra com teste o comportamento atual
- Não execute a separação do banco sem aprovação explícita
- Não suba versão do app nem faça build EAS
