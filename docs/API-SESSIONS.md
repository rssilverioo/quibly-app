# Contrato — Sessão de estudo

> **Público-alvo: squad Mobile.** É contra este documento que a Live Activity
> (iOS) e o Foreground Service (Android) são construídos. Publicado antes da
> implementação fechar, de propósito — ninguém precisa esperar o backend.
>
> Fase 1 · branch `f1/session-authority` · substitui o ciclo de vida antigo.

## O que mudou, em uma frase

**O servidor passou a ser dono do tempo.** O cliente não manda mais minutos,
não manda mais ciclos de pomodoro, e não decide quando a sessão começou.

Por que: o timer morava num `setInterval` dentro de um componente React
(`apps/mobile/app/session/active.tsx`), então app morto era sessão perdida; e a
duração vinha no corpo do `POST /sessions/end`, então o ranking público era
falsificável com um `curl`. As duas falhas têm a mesma raiz.

---

## 1. `POST /sessions/start`

```jsonc
// request
{
  "subject_id": "uuid",
  "league_id": "uuid",          // opcional
  "timer_mode": "pomodoro | deep_focus | custom | audio | stopwatch",
  "work_duration": 25,          // ignorado em stopwatch
  "break_duration": 5,          // ignorado em stopwatch
  "proof_mode": false
}
```

Repare no que **não** existe no corpo: nenhum timestamp. O servidor carimba
`startedAt` com o próprio relógio e já grava o primeiro heartbeat.

```jsonc
// 201
{
  "id": "uuid",
  "started_at": "2026-07-29T14:00:00.000Z",   // relógio do servidor
  "status": "active",
  "heartbeat_interval_seconds": 30,
  "heartbeat_grace_seconds": 300,
  "scheduled_proof_check_times": []
}
```

Os dois campos de heartbeat vêm na resposta para o app não hardcodar a cadência
— se um dia afrouxarmos a janela, o app acompanha sem release.

### 409 — já existe sessão viva

Antes, começar uma segunda sessão matava a primeira em silêncio. Isso permitia
dois aparelhos ficarem em ping-pong e o usuário nunca saber qual timer era real.
Agora é recusa, com a sessão viva no corpo do erro:

```jsonc
// 409
{
  "code": "SESSION_ALREADY_LIVE",
  "message": "You already have a live session. End or resume it before starting another.",
  "active_session": { "id": "uuid", "status": "active", "started_at": "...", "subject_id": "uuid" }
}
```

**O que o app deve fazer:** não tratar como erro. Ofereça retomar aquela sessão
ou encerrá-la. Um 409 aqui quase sempre significa "o app foi morto e reaberto",
que é o caso normal, não a exceção.

---

## 2. `POST /sessions/:id/heartbeat` — a cada 30s

O batimento que mantém a sessão viva. Precisa continuar enquanto a Live Activity
/ o Foreground Service estiverem de pé.

```jsonc
// 200
{
  "session_id": "uuid",
  "status": "active | paused",
  "server_time": "2026-07-29T14:10:00.000Z",
  "elapsed_seconds": 600,               // contagem do servidor, já sem pausas
  "next_heartbeat_in_seconds": 30
}
```

**`elapsed_seconds` é o número que a UI deve mostrar.** É o que torna o timer
honesto: o app renderiza um número que não é dele. Entre batimentos, conte
localmente a partir do último `elapsed_seconds` e reconcilie a cada resposta —
nunca acumule sozinho por muito tempo.

Bater numa sessão pausada é permitido e **não** a retoma. O app está aberto, o
usuário é que não está estudando; só a janela de carência é renovada.

---

## 3. `POST /sessions/:id/pause` · `/resume`

Cada pausa vira um intervalo gravado (`quibly_session_pauses`), não um contador.
O servidor desconta a soma dos intervalos ao calcular a duração — por isso o app
não precisa (nem deve) rastrear tempo pausado.

Encerrar uma sessão que ficou pausada credita só até o instante da pausa.

---

## 4. `POST /sessions/:id/end` — corpo vazio

```jsonc
// request
{}
```

Sim, vazio. Tudo vem do servidor:

| Número | De onde sai agora |
|---|---|
| duração | `endedAt − startedAt − Σ pausas` |
| ciclos de pomodoro | `floor(minutos ÷ work_duration)`, zero em `stopwatch`/`audio` |
| "saiu cedo" (penalidade hardcore) | `minutos < work_duration` — não completou um bloco |
| verificado | proof mode ligado **e** todos os proof checks passaram |

A fórmula de pontuação (`packages/shared/src/scoring.ts`) **não mudou uma
linha**. Só a procedência do que entra nela.

A resposta mantém o formato antigo (`{ session, score, newAchievements,
previousLevel, newLevel }`).

### Compatibilidade com a v1.2.1

`POST /sessions/end` (rota antiga, sem `:id`) continua existindo e aceitando o
corpo antigo — **os campos de duração são ignorados**, a duração é medida no
servidor do mesmo jeito. Instalação velha não quebra e passa a receber números
honestos. A rota sai quando o mínimo da loja passar da release que migrar para
`/:id/end`.

---

## 5. Sessão zumbi, carência e teto diário

### A janela de carência: 5 minutos

Dez batimentos perdidos. Generoso de propósito — rede móvel cai, o iOS suspende
trabalho em segundo plano com agressividade, o Android entra em doze.

O risco é assimétrico, e é isso que decide o número: uma janela **longa demais**
só atrasa a marcação da linha, porque a sessão varrida é creditada **até o
último batimento**, nunca até a varredura. Uma janela **curta demais** joga fora
tempo de estudo real. Então erra-se para o lado longo.

### A varredura

Um job de minuto em minuto (`sessions/sessions.sweeper.ts`) fecha toda sessão
viva calada além da carência. Ela vira `abandoned` com `end_reason:
"abandoned_no_heartbeat"` — **e é pontuada normalmente**, creditada até o último
batimento.

Isso é deliberado: se o celular morre depois de três horas de estudo real, zerar
os pontos seria punir o usuário por um bug que a própria Fase 1 está
consertando. A sessão varrida conta para a streak, para o teto diário e para o
histórico. O que não conta é o descarte explícito (`/abandon`), onde o usuário
disse que a sessão não deveria existir.

Com isso, o filtro `LIVE_SESSION_MAX_HOURS = 12` de `leagues.service.ts` saiu:
ele escondia zumbis da lista de "estudando agora" sem nunca fechá-los.

### Antifraude — proporcional, não paranoico

Nesta fase o servidor **registra e segue**. Ninguém é banido, bloqueado ou
penalizado automaticamente. Os sinais vão para `quibly_session_anomalies`:

| `kind` | Quando |
|---|---|
| `overlap_rejected` | tentou abrir sessão com uma já viva |
| `daily_cap_clipped` | o teto diário cortou o crédito |
| `implausible_duration` | uma sentada só passou do teto de um dia inteiro |
| `heartbeat_gap` | ficou calada além da carência |

### O número que falta

O teto de **16h/dia** não é uma medição — este repositório não tem dado de
produção para calibrá-lo. É um limite de sanidade: acima das ~12–14h que os
usuários mais pesados do YPT registram, abaixo das 24h que um loop de heartbeat
scriptado produziria.

**Ação pendente:** rodar a distribuição real de minutos por usuário/dia e ajustar.
Como o valor mora em `EntitlementsService` (chave `daily_study_minutes_cap`),
ajustar é um `UPDATE` em `quibly_entitlements` — não precisa de deploy.

---

## 6. Modo cronômetro (`stopwatch`)

Sem duração alvo: começa, corre, para. É o modo padrão do YPT e o mais usado
lá — pomodoro fixo é rígido demais para quem senta seis horas.

No servidor: `work_duration`/`break_duration` são ignorados, não ganha ciclos de
pomodoro (nem o bônus por ciclo, nem o SP de participação, que exige ao menos um
ciclo), e nunca sofre a penalidade de saída antecipada.

---

## 7. Ainda não implementado

**Tags de tópico no encerramento** (`SessionTopic`) — bloqueado. Depende de
`Topic`, que nasce no domínio de currículo da branch `f1/curriculum`, do squad
IA/Dados, que ainda não existe. Criar a tabela aqui colidiria com a migration
deles.

Isso alimenta a Fase 6 e é inegociável — não é opcional, só está fora de ordem.
Quando `f1/curriculum` entrar, o encerramento passa a aceitar `topic_ids` e
grava em `SessionTopic`. É uma mudança pequena e localizada em
`finalizeSession`; o resto do contrato não muda.

---

## 8. Fase 2

O heartbeat foi desenhado para o gateway de presença consumir depois: é uma
escrita por sessão viva a cada 30s, com `lastHeartbeatAt` indexado junto de
`status`. Presença ao vivo em WebSocket lê esse mesmo sinal — não há um segundo
canal a construir.
