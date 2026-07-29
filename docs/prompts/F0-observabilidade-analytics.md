# [SQUAD CORE · FASE 0] Taxonomia de analytics

Você é responsável por instrumentar o Quibly (app de estudo, Expo + NestJS) para
que as decisões de produto e de marketing parem de ser palpite. Roda **em
paralelo** ao `F0-core-fundacao.md`.

**Leia primeiro:** `docs/ARCHITECTURE.md` (§1, a North Star) e `docs/ROADMAP.md`.

Branch: `f0/analytics`.

---

## Contexto

Vamos lançar de graça para captar usuários e monetizar depois. Só faz sentido se
soubermos **o que segura gente**. Hoje existe `apps/mobile/lib/analytics.ts` com
Firebase Analytics e nenhuma taxonomia — eventos soltos, sem contrato.

**North Star:** minutos de estudo verificado por usuário por semana.
Todo evento existe para explicar essa métrica subir ou descer.

## Tarefa

### 1. Taxonomia versionada

Crie `packages/shared/src/analytics-events.ts` como **fonte única** dos nomes e
propriedades de evento, tipado. Mobile e API importam de lá. Nome de evento
literal espalhado pelo código é erro de revisão a partir daqui.

Cubra no mínimo:

| Funil | Eventos |
|---|---|
| Ativação | `onboarding_started`, `exam_track_selected`, `first_session_started`, `first_session_completed` |
| Hábito | `session_started`, `session_completed`, `session_abandoned`, `streak_extended`, `streak_broken` |
| Social | `room_viewed`, `room_joined`, `room_created`, `invite_shared`, `invite_opened` |
| IA | `lesson_captured`, `lesson_ready`, `quiz_started`, `quiz_completed`, `flashcards_reviewed` |
| Monetização (dormente) | `paywall_viewed`, `plan_selected`, `purchase_started`, `purchase_completed`, `purchase_failed` |

Propriedades obrigatórias em todo evento: `country_code`, `exam_track`,
`plan`, `app_version`, `platform`.

O corte por `country_code` × `exam_track` é o que vai dizer **qual país abrir
depois** — é a razão de existir dessa dimensão. Não é opcional.

### 2. Eventos de servidor

Eventos que decidem dinheiro não podem depender do cliente. `session_completed`,
`purchase_completed` e `lesson_ready` saem da API, não do app.

### 3. Retenção

Instrumentar para conseguir ler **D1 / D7 / D30 por coorte de semana de
instalação**, cortado por país e por track. É a métrica que decide quando a
Fase 7 (monetização) começa.

### 4. Escolha da plataforma

Existe Firebase Analytics no mobile. Avalie se ele basta ou se vale somar
PostHog (coortes e funis são muito melhores lá). **Traga a recomendação com
custo estimado antes de integrar** — não integre por conta própria.

---

## Pronto quando

- [ ] `analytics-events.ts` tipado, sendo a única fonte de nomes de evento
- [ ] Nenhuma string de evento literal fora desse arquivo
- [ ] Eventos críticos disparando do servidor
- [ ] Dá para ler D1/D7/D30 por coorte × país × track
- [ ] Recomendação de plataforma com custo, aguardando aprovação

## Não faça

- Não colete PII além do que já existe (e-mail e handle já estão no perfil)
- Não integre plataforma nova antes da aprovação
- Não instrumente tela por tela — evento sem pergunta de negócio atrás é ruído
