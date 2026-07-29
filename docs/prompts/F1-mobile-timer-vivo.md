# [SQUAD MOBILE · FASE 1] O timer que não morre

Você é o tech lead mobile do Quibly (Expo 54, expo-router, React Native, iOS +
Android). Sua tarefa é fazer a sessão de estudo sobreviver ao app ser fechado —
e aparecer na tela de bloqueio nos dois sistemas.

**Leia primeiro:** `docs/ROADMAP.md` (Fase 1) e `docs/PLATFORM-CONSTRAINTS.md` §1.

Branch: `f1/live-timer`. Depende do contrato de API do `f1/session-authority`
(o squad Core publica antes de terminar — peça se não tiver).

---

## O problema

`apps/mobile/app/session/active.tsx:78` roda o timer num `setInterval` dentro de
um componente React. Se o usuário trocar de app e o sistema matar o processo, a
sessão de estudo evapora.

Num app cujo produto **é** medir tempo de estudo, isso não é um bug de borda.
É o produto falhando na função principal.

## Tarefa

### 1. iOS — Live Activity + Dynamic Island

- Widget Extension com ActivityKit, timer rodando na tela de bloqueio
- Config plugin do Expo para o target sobreviver ao `prebuild` (não dá para
  depender de alguém lembrar de reconfigurar o Xcode)
- Ações rápidas na Live Activity: pausar e encerrar
- Estado atualizado por push quando o app estiver em background

### 2. Android — Foreground Service

- Foreground Service com notificação persistente e cronômetro
- Ações de pausar e encerrar na notificação
- Lidar com as restrições de bateria dos fabricantes (Xiaomi e Samsung matam
  serviço agressivamente): detecte e oriente o usuário quando aplicável

### 3. Cliente do heartbeat

- Heartbeat a cada 30s enquanto a sessão está ativa, incluindo em background
- Enfileirar e reenviar quando a rede voltar — usuário estuda em lugar com sinal ruim
- **Nunca** enviar duração calculada no cliente; a fonte da verdade é o servidor
- Reconciliar ao voltar para o app: pedir o estado real ao servidor e exibir
  ele, não o contador local

### 4. Modo cronômetro

Nova opção em `app/session/setup.tsx`, ao lado de pomodoro e deep focus. Sem
duração alvo — começa, corre, para. É o modo padrão do YPT e o mais usado por
quem estuda muitas horas seguidas.

### 5. Encerramento com tópicos

Ao encerrar, oferecer a marcação dos tópicos estudados (endpoint do squad Core).
Mantenha rápido — dois toques no máximo. Ninguém preenche formulário depois de
estudar 3 horas.

---

## Pronto quando

- [ ] Sessão sobrevive ao app ser morto, nos dois sistemas
- [ ] Live Activity com timer e ações no iOS
- [ ] Foreground Service com timer e ações no Android
- [ ] Heartbeat resiliente a rede ruim, com fila de reenvio
- [ ] Ao reabrir, a tela mostra o estado do servidor
- [ ] Modo cronômetro funcionando
- [ ] Marcação de tópicos em até dois toques
- [ ] Testado em device físico iOS **e** Android — simulador não prova nada aqui

## Não faça

- Não implemente bloqueio de apps nem Não Perturbe — é Fase 3, e tem um pedido
  de entitlement na Apple na frente (`PLATFORM-CONSTRAINTS.md` §1)
- Não redesenhe a tela de sessão além do necessário — o redesenho vem na Fase 2
- Não suba versão nem faça build de produção sem alinhar
