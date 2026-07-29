# Quibly — Arquitetura Alvo

> Documento vivo. Escrito em 2026-07-28. Toda decisão aqui é revisável, mas
> nenhuma deve ser contrariada em silêncio: se um squad discordar, abre issue.

---

## 1. Tese do produto

**Quibly é a sala de estudo global com IA.**

Dois loops que se alimentam:

```
   LOOP SOCIAL (retenção diária)          LOOP DE IA (valor único)
   ┌──────────────────────────┐          ┌──────────────────────────┐
   │  entra na sala           │          │  captura a aula          │
   │  vê quem está estudando  │          │  vira resumo + flashcard │
   │  liga o timer            │          │  vira quiz               │
   │  aparece no ranking      │          │  quiz mede o domínio     │
   └──────────┬───────────────┘          └───────────┬──────────────┘
              │                                       │
              └───────────────► PLANO ◄───────────────┘
                    o plano define a próxima sessão
```

O YPT tem o loop da esquerda e para ali. Quem estuda 4h no YPT continua sem
saber **se** aprendeu. Nosso diferencial não é ter IA — é **fechar o ciclo**:
o que você estudou vira material, o material vira medição, a medição vira o
plano, o plano vira a próxima sessão.

**North Star Metric:** minutos de estudo verificado por usuário por semana.

**Não é a métrica:** downloads, MAU, número de salas. São vaidade.

---

## 2. A decisão arquitetural central: Currículo como eixo

Este é o coração do "Brasil primeiro, depois o mundo". Sem isso, cada novo país
é um refactor; com isso, um novo país é um **seed de dados**.

```
Country (BR, US, PT, DE, UK…)
  └── ExamTrack        ENEM · Concursos · OAB · SAT · AP · GCSE · Abitur
        └── Discipline  Matemática · Redação · Biologia
              └── Topic  "Funções quadráticas" (peso, frequência em prova)
```

O `Topic` é a unidade atômica do sistema inteiro. Ele conecta:

| Domínio | Como usa o Topic |
|---|---|
| Onboarding | geo + locale → sugere ExamTrack → popula Subjects |
| Salas | descoberta e ranking **por track** ("Salas de ENEM", "SAT rooms") |
| Sessão | usuário marca o que estudou → tags de topic |
| Quiz | toda questão tem `topicId` |
| Mastery | domínio do usuário é medido **por topic** |
| Plano | currículo × domínio × dias até a prova → roteiro |

> ⚠️ **Regra inegociável:** o tagging de topic começa na Fase 1. Se deixarmos
> para a Fase 6, o gerador de plano nasce sem dados históricos e precisa de um
> backfill que não existe. Isso já matou produto melhor que o nosso.

---

## 3. Arquitetura de sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  MOBILE  Expo 54 · expo-router · React Native                   │
│  ├── Módulos nativos: FamilyControls (iOS) · DND (Android)      │
│  ├── Live Activity (iOS) / Foreground Service (Android)         │
│  ├── watchOS target (SwiftUI + WatchConnectivity)               │
│  └── expo-calendar (EventKit + CalendarProvider)                │
└───────────────┬──────────────────────────┬──────────────────────┘
                │ REST                      │ WebSocket
┌───────────────▼──────────────────────────▼──────────────────────┐
│  API  NestJS 10                                                  │
│  ├── Domínio: sessions · rooms · curriculum · mastery · plan    │
│  ├── RealtimeGateway (socket.io + Redis adapter)                │
│  ├── EntitlementService (feature flags + plano)                 │
│  └── AiRouter (roteia modelo por tarefa + orçamento por usuário)│
└───┬────────────┬───────────────┬───────────────┬────────────────┘
    │            │               │               │
┌───▼────┐  ┌───▼────┐   ┌──────▼──────┐  ┌────▼─────┐
│Postgres│  │ Redis  │   │  S3         │  │ OpenAI   │
│(Prisma)│  │presença│   │  áudio/pdf  │  │ Gemini   │
└────────┘  │pub/sub │   └─────────────┘  └──────────┘
            └────────┘
```

### Decisões e por quê

**Realtime: NestJS Gateway + Redis. Não Supabase Realtime, não Ably.**
O `supabase/schema.sql` é legado — já migramos para Prisma/Railway. Reintroduzir
a Supabase só pelo realtime significa duas plataformas, dois modelos de auth e
duas fontes de verdade. Redis no Railway resolve presença (TTL) e pub/sub
(fan-out entre instâncias) sem nova dependência de plataforma.

**Sessão com autoridade no servidor.**
Hoje o timer é um `setInterval` dentro de um componente React
(`app/session/active.tsx:78`). Consequências: o timer morre se o app for morto,
e o cliente pode mentir sobre a duração. Com ranking público, isso é fatal.
Novo contrato: cliente envia `start` / `heartbeat` (30s) / `end`; **o servidor
calcula a duração**. O heartbeat também substitui o hack de sessão-zumbi de 12h
(`leagues.service.ts:16`).

**Entitlements desde já, com tudo ligado.**
Lançamos de graça — mas com uma camada de entitlement em produção desde o dia 1,
com todos os limites em `Infinity`. Monetizar depois vira `UPDATE` de config,
não refactor. Sem isso, "vamos cobrar depois" custa um trimestre.

**AiRouter com orçamento por usuário.**
Grátis + LLM = queima de caixa proporcional ao sucesso. Toda chamada de IA passa
por um roteador que (a) escolhe o modelo pela tarefa, (b) debita de um orçamento
diário de tokens por usuário, (c) cacheia agressivamente. O `AudioClip.textHash`
já faz isso para TTS — é o instinto certo, generalizar.

---

## 4. Mudanças no modelo de dados

### League → Room

`League` hoje é um **desafio** (tem `startDate`, `endDate`, `status: completed`).
As salas do YPT são **permanentes**. Um desafio é um evento *dentro* de uma sala.

```
Room            permanente · pública ou privada · ligada a um ExamTrack
 ├── RoomMember  displayName, papel, SP acumulado
 ├── Challenge   (era League) evento com prazo dentro da sala — opcional
 ├── ChatMessage
 └── FeedPost
```

Migração: renomear, adicionar `examTrackId`, tornar datas opcionais. Os dados
existentes viram salas permanentes com um desafio concluído dentro.

### Novas tabelas

| Tabela | Papel |
|---|---|
| `Country`, `ExamTrack`, `Discipline`, `Topic` | o currículo (§2) |
| `TopicMastery` | por usuário × topic: tentativas, acertos, ease, próxima revisão (FSRS) |
| `SessionTopic` | o que foi estudado em cada sessão |
| `Entitlement` | limites por plano, editável sem deploy |
| `AiUsageLedger` | tokens gastos por usuário/dia/tarefa — controle de custo |

### Alterações

- `Question` → ganha `topicId` (obrigatório para questões geradas)
- `StudySession` → ganha `stopwatch` no enum `TimerMode`, mais `lastHeartbeatAt`
- `Profile` → ganha `countryCode`, `examTrackId`, `timezone`

---

## 5. Segurança e custo — dívida a pagar na Fase 0

| Item | Estado hoje | Alvo |
|---|---|---|
| Testes | **zero** | suíte em scoring, entitlements, sessões, salas |
| CI | **zero** | lint + typecheck + test + `prisma validate` no PR |
| CORS | `app.enableCors()` aberto | allowlist explícita |
| Rate limit | inexistente | `@nestjs/throttler` global + limites por rota de IA |
| Código de convite | `Math.random()`, sem retry de colisão | `crypto.randomBytes` + retry |
| Banco | compartilhado com outro produto | schema dedicado ou instância própria |
| Observabilidade | `console.log` | Sentry (API + mobile) + logs estruturados |

Detalhe do banco: o schema tem `@@map("captured_lessons")` com o comentário de
que `lessons` pertence a outro produto no mesmo Postgres de produção. Enquanto
isso for verdade, uma migration nossa pode derrubar o vizinho — e vice-versa.

---

## 6. O que ficou de fora, e por quê

**Garmin (Connect IQ).** Aplicativo separado, em Monkey C, com SDK, loja e ciclo
de review próprios. O custo é de um app inteiro; o público de estudante com
Garmin é rounding error. **Recomendação: cortar agora, revisitar acima de 100k
usuários ativos.** Apple Watch e Wear OS cobrem o caso de uso real.

**Anúncios no free.** Matam a percepção de produto premium e o eCPM no Brasil é
baixo demais para compensar. O YPT tem ads porque nasceu em 2018 na Coreia com
outra estrutura de custo. Monetizamos por assinatura e por limite de salas.

**Moeda interna ("Flames" do YPT).** Adiciona uma economia inteira para manter.
Só faz sentido depois que houver retenção comprovada.
