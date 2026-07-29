# Roadmap — Reformulação Quibly

> ~6 meses até a versão que compete com o YPT. Cada fase entrega algo que o
> usuário sente. Nenhuma fase é "refactor invisível" — a Fase 0 é a única
> exceção, e ela roda **em paralelo**, não bloqueando as outras.

**Legenda:** 🔴 bloqueia lançamento · 🟠 dívida que cresce · 🟢 incremental

---

## Fase 0 — Fundação `2 semanas` `paralela a tudo`

Nada aqui aparece na tela. Tudo aqui evita perder um trimestre depois.

| Entrega | Por quê |
|---|---|
| 🔴 CI no PR: lint + typecheck + test + `prisma validate` | 27k linhas, 48 commits, zero CI |
| 🔴 Primeira suíte de testes: scoring, entitlements, sessões, convites | Zero testes hoje, com IAP em produção |
| 🔴 CORS com allowlist + Helmet | `main.ts:11` está aberto para qualquer origem |
| 🔴 `@nestjs/throttler` global + limite por rota de IA | Cada request de IA custa dinheiro real |
| 🔴 `EntitlementService` — tudo ligado, limites em `Infinity` | Permite lançar grátis e monetizar sem refactor |
| 🔴 `AiUsageLedger` + orçamento diário de tokens | Grátis + LLM = queima proporcional ao sucesso |
| 🟠 Separar o banco do produto vizinho | Migration nossa pode derrubar o outro app |
| 🟠 Sentry (API + mobile) + logs estruturados | Hoje é `console.log` |
| 🟠 Código de convite: `crypto.randomBytes` + retry | `Math.random()` sem tratar colisão do `@unique` |
| 🟢 Taxonomia de eventos de analytics | A base do trabalho de marketing |

**Saída:** dá para mexer no produto sem medo, e dá para medir o que acontece.

---

## Fase 1 — Timer confiável + Currículo `3–4 semanas`

O alicerce dos dois loops. Sem isto, tudo depois é castelo na areia.

| Entrega | Detalhe |
|---|---|
| 🔴 Sessão com autoridade no servidor | `start` / `heartbeat` 30s / `end`; servidor calcula duração |
| 🔴 Live Activity (iOS) + Foreground Service (Android) | **Hoje o timer morre se o app for morto** — é bug de correção no coração do produto |
| 🔴 Domínio de currículo | `Country → ExamTrack → Discipline → Topic` |
| 🔴 Seeds BR: ENEM, concursos, OAB · US: SAT, AP | Os dois mercados do dia 1 |
| 🔴 Onboarding por geo | localização + locale → sugere track → popula subjects |
| 🔴 **Tagging de topic em sessões e questões** | Sem isto a Fase 6 nasce sem dados. Inegociável. |
| 🟢 Modo cronômetro (estilo YPT) | Pomodoro fixo é rígido demais para quem estuda 6h |

**Saída:** o usuário escolhe "ENEM" e o app já sabe o que ele estuda. O timer
não mente e não morre.

---

## Fase 2 — Salas ao vivo `3–4 semanas`

O coração do YPT. É aqui que a retenção nasce.

| Entrega | Detalhe |
|---|---|
| 🔴 `League` → `Room` | Salas permanentes, ligadas a um ExamTrack |
| 🔴 Gateway WebSocket + Redis | Presença com TTL, pub/sub entre instâncias |
| 🔴 Presença ao vivo | Quem está estudando **agora**, qual matéria, há quanto tempo |
| 🔴 Ranking em tempo real | Dia / semana / mês / geral — por sala e global por track |
| 🔴 Descoberta de salas públicas | Por track e país — "Salas de ENEM", "SAT rooms" |
| 🟠 Chat em tempo real | Mata o polling de `services/chat.ts:20` |
| 🔴 Notificações do loop social | Ver abaixo |
| 🟢 Heatmap de estudo | A cor escurece conforme estuda (YPT faz, funciona) |

**Saída:** existe motivo para abrir o app todo dia mesmo sem vontade de estudar.

### Notificações — o que já existe e o que falta

Boa notícia: a infraestrutura **já está de pé** e é decente. FCM via
`firebase-admin`, registro de token (`push_tokens`), pedido de permissão no
mobile, e envios já implementados para reação, comentário, chat (com debounce de
60s — instinto certo), conquistas e `broadcastToSegment`.

O que falta é ligá-la ao loop que importa:

| Gatilho | Por que retém |
|---|---|
| Alguém da sua sala começou a estudar | É *o* gatilho do YPT. Puxa você para dentro. |
| Você caiu de posição no ranking | Competição, o motor da sala |
| Sua sequência acaba hoje | Aversão à perda, o gatilho mais forte que existe |
| Desafio da sala termina em 24h | Prazo cria pico de uso |
| Material da aula ficou pronto | Fecha o loop de IA |

🔴 **Junto com isso, preferências por usuário.** Notificação social sem controle
granular vira desinstalação em duas semanas. Precisa de: liga/desliga por tipo,
horário de silêncio, e respeito ao fuso (`Profile.timezone` chega na Fase 1).
Sem isso, não ligamos as notificações novas.

Adicionar também métrica de entrega e de abertura por tipo — hoje enviamos às
cegas, sem saber o que funciona.

---

## Fase 3 — Foco de verdade + Calendário `3 semanas`

> 🔴 **Semana 1:** pedir a entitlement `com.apple.developer.family-controls` à
> Apple. Leva semanas. Se esperarmos o código ficar pronto, a Apple vira o
> gargalo. Ver `PLATFORM-CONSTRAINTS.md §1`.

| Entrega | Detalhe |
|---|---|
| 🔴 iOS: bloqueio de apps via Screen Time | `FamilyControls` + `ManagedSettings` + `DeviceActivity` |
| 🔴 Android: Não Perturbe real + bloqueio | `setInterruptionFilter` + `UsageStatsManager` |
| 🟢 Atalho iOS publicado | Usuário automatiza o Foco uma vez |
| 🟢 Calendário nos dois OS | `expo-calendar`: plano → eventos na agenda |

**Saída:** a sessão de estudo defende a si mesma.

---

## Fase 4 — Fechando o loop de IA `3–4 semanas`

Nosso trunfo — hoje está escondido atrás de um paywall de 3 flashcards/dia.

| Entrega | Detalhe |
|---|---|
| 🔴 Captura de aula reformulada | É o diferencial contra o YPT; hoje é secundária na UI |
| 🔴 Todo material gerado com `topicId` | Liga o loop de IA ao currículo |
| 🔴 Quiz alimenta `TopicMastery` | Acertos/erros por tópico, ease factor |
| 🟢 Revisão espaçada (FSRS) | `next_due` por tópico |

**Saída:** o app passa a saber o que o usuário domina — não só quanto tempo sentou.

---

## Fase 5 — Relógios + polimento `3 semanas`

| Entrega | Detalhe |
|---|---|
| 🟢 Apple Watch nativo | Target SwiftUI + WatchConnectivity + complicação |
| 🟢 Wear OS | Metade do custo do Apple Watch; o YPT já tem |
| ⚫ Garmin | **Cortado.** Ver `PLATFORM-CONSTRAINTS.md §3` |

---

## Fase 6 — Plano de estudo com IA `4 semanas`

O que você chamou de "plano funcional / roteiro". Só é possível porque a Fase 1
começou a taguear tópicos.

```
currículo (peso do tópico na prova)
      ×  domínio do usuário (TopicMastery)
      ×  dias até a prova
      ×  minutos disponíveis por dia
      =  plano diário, replanejado sozinho
```

| Entrega | Detalhe |
|---|---|
| 🔴 Gerador de roteiro | Agente com saída estruturada → linhas de `DailyPlan` |
| 🔴 Replanejamento automático | Falhou 3 dias? O plano se ajusta, não acumula culpa |
| 🟢 Escrita no calendário server-side | Só aqui a Google Calendar API se justifica |

**Saída:** *"hoje você estuda funções quadráticas por 40min — você errou 6 das
últimas 10 e vale 8% da prova."* É isso que o YPT nunca vai fazer.

---

## Fase 7 — Monetização `quando houver retenção, não antes`

Lançamos grátis. Ligamos os limites quando o D30 provar que o produto segura
gente. Como a Fase 0 construiu a camada de entitlement, isto é configuração:

| Alavanca | Proposta inicial |
|---|---|
| Salas | 3 grátis · ilimitadas no PRO |
| IA | cota diária no free · ilimitada no PRO |
| Bloqueio de apps | grátis (é o gancho de hábito) |
| Relógio, calendário, plano de IA | PRO |
| Anúncios | **não.** Ver `ARCHITECTURE.md §6` |

---

## Times

| Squad | Dono de | Fases |
|---|---|---|
| **Core** (backend) | domínio, gateway, entitlements, custo de IA | 0, 1, 2 |
| **Mobile** | timer, salas, UI das sessões | 1, 2, 4 |
| **Native** | Screen Time, DND, calendário, watchOS | 3, 5 |
| **IA/Dados** | currículo, mastery, agente de plano | 1, 4, 6 |
| **Growth** | analytics, ASO, aquisição *(Rodrigo)* | contínuo |

Prompts de delegação por squad em `docs/prompts/`.
