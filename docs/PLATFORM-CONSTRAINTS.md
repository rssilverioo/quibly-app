# Restrições de plataforma — o que dá e o que não dá

> Leia antes de prometer qualquer coisa dessas em marketing. Várias features
> pedidas existem, mas **não do jeito que parecem existir em outros apps**.

---

## 1. Focus Mode — a armadilha

### O que o Strava e o Lunar realmente fazem

**Nenhum app de terceiro pode ligar o Modo Foco do iOS por conta própria.**
A Apple não expõe API para isso, e não vai expor. Quando um app de corrida
"coloca você em foco", uma de três coisas está acontecendo:

1. O usuário configurou **uma automação do Atalhos** ("quando o app X abrir,
   ligar Foco") — trabalho do usuário, não do app.
2. O app oferece um **Focus Filter** (`SetFocusFilterIntent`), que só muda o
   comportamento *do próprio app* quando o usuário já está em foco.
3. É só uma **Live Activity** ocupando a tela de bloqueio, dando a *sensação*
   de foco sem silenciar nada.

Se prometermos "o Quibly ativa o foco" no iOS, entregamos uma mentira.

### O que nós podemos fazer — e é mais forte

| Plataforma | Mecanismo real | Efeito |
|---|---|---|
| **iOS** | Screen Time: `FamilyControls` + `ManagedSettings` + `DeviceActivity` | **Bloqueia de fato** os apps que o usuário escolher, durante a sessão. Mais forte que DND. |
| **iOS** | Live Activity + Dynamic Island | Timer visível na tela bloqueada, sem abrir o app |
| **iOS** | App Intent + Atalho que a gente publica | Usuário liga a automação uma vez, o Foco passa a acender sozinho |
| **Android** | `NotificationManager.setInterruptionFilter()` + permissão `ACCESS_NOTIFICATION_POLICY` | **Liga o Não Perturbe de verdade** — o Android permite |
| **Android** | `UsageStatsManager` + overlay de bloqueio | Bloqueia apps distrativos |
| **Android** | Foreground Service + notificação persistente | Timer sobrevive ao app fechado |

**Promessa honesta para o marketing:** *"O Quibly tira as distrações do caminho:
no Android ele liga o Não Perturbe, no iOS ele bloqueia os apps que te derrubam."*
Mesma promessa, mecânica diferente por plataforma. Nada de "ativa o Foco no iPhone".

### Decisão de produto: o bloqueio tem porta de saída

O usuário **sempre pode sair** do bloqueio. Sem senha de resgate, sem prisão, sem
fricção artificial. Motivos, em ordem de importância:

1. **Confiança.** Um app que sequestra o telefone é desinstalado, não amado.
2. **Loja.** Bloqueio sem saída clara é rejeição na App Review e denúncia no Play.
3. **É o que funciona.** O atrito certo é o custo social — sair da sessão aparece
   para a sala. A culpa vem do grupo, não do software.

Implementação: a tela de bloqueio (shield) tem botão de encerrar sessão. Encerrar
antes do combinado aplica a penalidade de SP que já existe
(`SCORING.EARLY_EXIT_PENALTY_PERCENT`) e some da lista de presença ao vivo.

### O bloqueio de custo: a entitlement da Apple

`com.apple.developer.family-controls` **exige aprovação manual da Apple** para
distribuição. Funciona em desenvolvimento sem ela, mas a submissão é rejeitada.

- Precisa ser pedida para **todos** os App IDs: app principal + extensões
- Exige **custom dev client** no Expo (não roda no Expo Go)
- Apple costuma levar **semanas** e pode pedir justificativa de uso
- iOS 15+

> 🔴 **Ação crítica de cronograma:** o pedido da entitlement precisa ser enviado
> na **primeira semana da Fase 3**, não quando o código estiver pronto. Se
> esperarmos o código, a Apple vira o gargalo do lançamento.

Biblioteca: `react-native-device-activity` (kingstinct) é a mais completa —
expõe Screen Time, DeviceActivity e shielding com config plugin de Expo.

---

## 2. Calendário

**Boa notícia: é o item mais simples da lista.**

`expo-calendar` cobre iOS (EventKit) e Android (CalendarProvider) com **uma só
API**. E resolve o "integrar com Google Calendar" de graça: se a conta Google
está adicionada no dispositivo, os calendários dela aparecem na mesma API — nos
dois sistemas.

Só precisaríamos da Google Calendar API server-side (o `googleapis` já está nas
dependências da API) se quiséssemos escrever eventos **sem o dispositivo do
usuário** — ex.: o plano replanejar sozinho durante a noite. Isso é Fase 6, não
Fase 3.

**Recomendação:** `expo-calendar` na Fase 3. OAuth server-side só se a Fase 6
provar que precisa.

### Entrada manual também

Nem todo usuário vai conectar o calendário — e alguns não têm nada agendado lá.
O planejamento manual não é o plano B, é o caminho principal na Fase 3:

- Usuário monta os blocos de estudo dentro do Quibly, na mão
- Escolhe exportar (ou não) para o calendário do sistema
- A sincronia é **opcional e reversível**, nunca pré-requisito

Na Fase 6 o gerador de IA preenche esses mesmos blocos. Ou seja: a estrutura de
dados é a mesma, muda só quem preenche. Construir o manual primeiro é o que faz
a Fase 6 ser um gerador, e não um produto novo.

---

## 3. Relógios

### Apple Watch — dá, mas é trabalho nativo de verdade

React Native não roda no watchOS. O caminho é:

1. Target **watchOS nativo em SwiftUI** dentro do `Quibly.xcodeproj`
2. **WatchConnectivity** para sincronizar sessão entre telefone e relógio
3. **Config plugin do Expo** para o target sobreviver ao `prebuild`
4. Complicação no mostrador + start/stop no pulso

Custo real: **2–3 semanas de um dev iOS nativo**. Não é "mais uma tela".
Vale a pena — o relógio é exatamente onde o timer de estudo deveria viver.

### Wear OS — mais barato

O YPT já tem, e é um diferencial dele hoje. Módulo Kotlin + Data Layer API.
Cerca de metade do custo do Apple Watch.

### Garmin — recomendo cortar

App **separado**, em **Monkey C**, com SDK, loja e review próprios. É construir
um terceiro app para uma fração de usuários que não se sobrepõe ao nosso público.
**Corte agora. Revisitar acima de 100k usuários ativos.**

---

## 4. Resumo para o cronograma

| Feature | Viável? | Onde entra | Risco |
|---|---|---|---|
| Bloqueio de apps iOS | ✅ | Fase 3 | 🔴 Entitlement da Apple (semanas) |
| DND real Android | ✅ | Fase 3 | 🟢 |
| "Ativar Foco" no iOS | ❌ | — | Não prometer |
| Live Activity / Foreground Service | ✅ | **Fase 1** (o timer hoje morre) | 🟢 |
| Calendário iOS + Android | ✅ | Fase 3 | 🟢 |
| Apple Watch | ✅ | Fase 5 | 🟡 Precisa de dev iOS nativo |
| Wear OS | ✅ | Fase 5 | 🟢 |
| Garmin | ⚠️ | Cortado | Custo de um app inteiro |
