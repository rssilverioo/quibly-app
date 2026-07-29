# [SQUAD CORE · FASE 1] Sessão com autoridade no servidor

Você é o tech lead de backend do Quibly (app de estudo, NestJS + Prisma). Sua
tarefa é reescrever o ciclo de vida da sessão de estudo para que **o servidor
seja a fonte da verdade sobre o tempo**.

**Leia primeiro:** `docs/ARCHITECTURE.md` §3 e `docs/ROADMAP.md` (Fase 1).

Branch: `f1/session-authority`. Depende do CI da Fase 0.

---

## O problema

Duas falhas na mesma raiz:

1. **O timer mora no cliente.** `apps/mobile/app/session/active.tsx:78` é um
   `setInterval` dentro de um componente React. App morto = sessão perdida.
2. **O cliente reporta a duração.** Com ranking público, isso é convite a
   fraude. Um app de estudo cujo ranking dá para burlar não tem produto.

O sintoma disso já está no código: `apps/api/src/leagues/leagues.service.ts:16`
define `LIVE_SESSION_MAX_HOURS = 12` para varrer "sessões zumbi". É um curativo
na ausência de heartbeat.

## Tarefa

### 1. Novo contrato

```
POST   /sessions              inicia; servidor grava startedAt
POST   /sessions/:id/heartbeat   a cada 30s; servidor grava lastHeartbeatAt
POST   /sessions/:id/pause    /resume
POST   /sessions/:id/end      servidor calcula a duração
```

- A duração vem do servidor. O cliente **nunca** manda minutos.
- Intervalos de pausa registrados, para descontar do total corretamente.
- Tolerância de heartbeat perdido (rede oscila, celular dorme): defina uma
  janela de carência explícita e documente a escolha.

### 2. Matar as sessões zumbi de verdade

Job periódico: sessão `active` sem heartbeat além da carência vira
`abandoned`, creditando **só** o tempo até o último heartbeat. Remova o
`LIVE_SESSION_MAX_HOURS` depois que isso estiver de pé.

### 3. Antifraude — proporcional, não paranoico

Ainda não é o momento de sistema antifraude completo. É o momento de **não ser
trivial de burlar** e de deixar rastro:

- Rejeitar sessões sobrepostas do mesmo usuário
- Teto de horas por dia (defina com base nos dados atuais, não no chute)
- Registrar sinais para análise depois; não bane ninguém automaticamente ainda

### 4. Modo cronômetro

Adicionar `stopwatch` ao enum `TimerMode`. Pomodoro fixo é rígido para quem
estuda 6 horas — é o modo padrão do YPT e o mais usado lá. Sem duração alvo:
começa, corre, para.

### 5. Tags de tópico na sessão

Ao encerrar, o usuário pode marcar os tópicos estudados → gravar em
`SessionTopic` (tabela criada pelo squad IA/Dados em `f1/curriculum`).

Isso alimenta a Fase 6. **Não é opcional, mesmo parecendo secundário agora.**

### 6. Contrato para o Mobile

O squad Mobile depende deste contrato para a Live Activity (iOS) e o Foreground
Service (Android). **Publique a API antes de terminar a implementação** — eles
não podem ficar bloqueados esperando.

---

## Pronto quando

- [ ] Duração calculada exclusivamente no servidor
- [ ] Heartbeat funcionando, com carência documentada
- [ ] Sessão zumbi vira `abandoned` com crédito parcial correto
- [ ] `LIVE_SESSION_MAX_HOURS` removido
- [ ] Modo `stopwatch` funcionando ponta a ponta
- [ ] Tópicos gravados no encerramento
- [ ] Contrato publicado para o Mobile
- [ ] Testes: heartbeat perdido, pausa/retomada, sobreposição, crédito parcial

## Não faça

- Não mexa nas fórmulas de scoring (`packages/shared/src/scoring.ts`) — só na
  origem do número de minutos que entra nelas
- Não implemente presença ao vivo em WebSocket (é Fase 2) — mas deixe o
  heartbeat num formato que o gateway consiga consumir depois
- Não banir usuário automaticamente
