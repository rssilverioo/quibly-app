# Analytics — taxonomia, retenção e escolha de plataforma

> Fase 0. Ver `docs/prompts/F0-observabilidade-analytics.md` para o mandato e
> `docs/ARCHITECTURE.md` §1–§2 para a North Star e o eixo de currículo.

## 1. Onde vive a verdade

`packages/shared/src/analytics-events.ts` é a única fonte de nomes e
propriedades de evento. Mobile (`apps/mobile/lib/analytics.ts`) e API
(`apps/api/src/analytics/analytics.service.ts`) importam de lá — nenhuma
string de nome de evento deve existir fora desse arquivo. Um typo no nome de
um evento é erro de compilação, não um funil quebrado que ninguém percebe por
três meses.

Cada evento carrega cinco propriedades obrigatórias:

| Propriedade | Hoje | Quando fica real |
|---|---|---|
| `country_code` | sempre `"unknown"` | Fase 1, quando `Profile.countryCode` existir |
| `exam_track` | sempre `"unknown"` | Fase 1, quando `Profile.examTrackId` existir |
| `plan` | real (`FREE`/`PRO`, do perfil) | já |
| `app_version` | real no mobile; `"server"` em eventos de servidor | já |
| `platform` | real (`ios`/`android`) no mobile; `"unknown"` no servidor | já |

`country_code` × `exam_track` é o corte que decide qual país abrir depois
(ARCHITECTURE.md §2) — por isso o contrato já carrega os dois campos, mesmo
sem dado real ainda. Até a Fase 1 popular `Profile.countryCode` /
`Profile.examTrackId`, qualquer relatório cortado por essas duas dimensões
mostra uma única coorte, `unknown` × `unknown`. Isso é esperado, não é bug —
é o motivo de o corte já estar no contrato antes de ter dado.

## 2. Cliente vs. servidor

`SERVER_SOURCED_EVENTS` (em `analytics-events.ts`) lista os eventos que só a
API pode emitir: `session_completed`, `session_abandoned`,
`streak_extended`, `streak_broken`, `lesson_ready`,
`lesson_processing_failed`, `purchase_completed`. O tipo `ClientSourcedEvent`
exclui esses nomes do `track()` do mobile — passar `session_completed` para
`track()` no app é erro de compilação, não um bug de produção.

Por quê: o cliente pode mentir sobre duração de sessão, morrer no meio da
sessão, ou nunca chamar o endpoint que reportaria uma falha
(ARCHITECTURE.md §3, "Sessão com autoridade no servidor"). Dinheiro e o
fechamento do loop de IA não podem depender disso.

Hoje o lado servidor emite cada evento como uma linha de log JSON estruturada
(`apps/api/src/analytics/analytics.service.ts`), buscável no Railway. Não há
sink de rede ainda — ver §4 sobre por quê e o que falta para ligar um.

## 3. Lendo D1 / D7 / D30 por coorte × país × track

A pergunta que decide a Fase 7 (ROADMAP.md): "quem volta, e depende de quê."
Isso é uma pergunta de **retenção por coorte de instalação**, não uma soma de
eventos — e é exatamente o tipo de relatório em que PostHog é muito melhor
que o Firebase console (ver §4).

### O que já dá para fazer hoje

Com o funil de Hábito instrumentado (`session_started` no dia de instalação
como proxy de "ativou", `session_started` em dias seguintes como proxy de
retenção), dá para montar a Retention insight do PostHog assim:

1. **PostHog → Product analytics → New insight → Retention**
2. **Returning event / Starting event:** `session_started` para os dois —
   isso mede "voltou para estudar", que é mais perto da North Star do que
   "abriu o app".
3. **Time frame:** semanal (coorte = semana de instalação, que é como o
   `docs/ROADMAP.md` e `docs/prompts/F0-observabilidade-analytics.md`
   descrevem o corte). Os pontos D1/D7/D30 saem do mesmo insight lendo a
   coluna do dia/semana correspondente.
4. **Breakdown:** hoje só existe um breakdown útil de verdade —
   `plan` (FREE vs. PRO). `country_code` e `exam_track` **não vão segmentar
   nada** até a Fase 1, porque toda linha carrega `"unknown"`. Adicionar o
   breakdown agora é inofensivo (o insight simplesmente mostra uma coorte
   `unknown`) e funciona sem alteração assim que a Fase 1 popular esses
   campos — é por isso que o contrato já os inclui.

### O que falta para o corte real (país × track)

Nada de código — é dado. No dia em que `Profile.countryCode` /
`Profile.examTrackId` existirem (Fase 1) e o mobile/API pararem de mandar
`"unknown"`, o mesmo insight acima recortado por `country_code` e
`exam_track` já responde "D7 de quem estuda para o ENEM no Brasil" vs. "D7 de
quem estuda para a OAB". Nenhum evento novo é necessário — os que já existem
carregam a propriedade, só falta o valor real.

### Uma verificação a fazer antes de decidir a Fase 7

`session_started` sozinho mistura "abriu e estudou 2 minutos" com "estudou a
sessão inteira". Antes de usar D7/D30 para decidir monetização, troque o
Starting/Returning event do insight acima por `first_session_completed` /
`session_completed` (ambos server-sourced, portanto não falsificáveis pelo
cliente) — isso é retenção de **estudo verificado**, a métrica que
ARCHITECTURE.md §1 realmente pede, não retenção de "abriu o app".

## 4. Firebase Analytics vs. PostHog — recomendação

### Achado que muda a pergunta

O mandato original era "avalie se soma PostHog, não integre sem aprovação".
**Isso já não é mais a decisão disponível: o PostHog já está em produção.**
`posthog-react-native` é dependência real (`apps/mobile/package.json`), já
estava sendo chamado em `lib/analytics.ts` antes desta tarefa (commit
`467a755`), e a chave de projeto real está hardcoded nos três perfis de build
em `apps/mobile/eas.json` (`development`, `preview`, `production`) —
não é uma chave de exemplo. **Cada instalação de produção do app desde esse
commit já está mandando eventos para o PostHog.**

(Isso não é um problema de segurança: chaves de projeto do PostHog, como o
Measurement ID do GA4, são write-only por design — servem para receber
eventos, não para ler dados. Só a API key do dashboard, que não está no
repo, dá acesso de leitura.)

Esta tarefa não integrou nada novo — a taxonomia deste PR só deu nome e
contrato ao que os dois SDKs já enviavam soltos. A recomendação abaixo é
sobre **manter e formalizar** o que já está rodando, não sobre adotar algo
novo.

### Recomendação: manter os dois, com papéis diferentes — não é F1 nem custo extra

| | Firebase / GA4 | PostHog |
|---|---|---|
| Papel | Attribution do Google Ads, console que o time de growth já conhece | Funis, coortes de retenção, breakdown por propriedade — o que a Fase 7 precisa |
| Retenção por coorte semanal × propriedade | Fraco — GA4 tem "retenção" mas não permite redefinir o evento de retorno nem cruzar com propriedades customizadas sem BigQuery pago | Nativo (Retention insight, §3) |
| Custo | Grátis, sem teto de eventos (limite é de *nomes* de evento distintos: 500/projeto — a taxonomia usa ~30, sobra folga) | Grátis até 1M eventos/mês de product analytics; ver tabela abaixo |
| Já pago hoje | R$0 | R$0 provável — ver estimativa |

Não recomendo desligar nenhum dos dois: GA4 é a única ponte com Google Ads
attribution (relevante quando a aquisição paga começar), e PostHog é a única
ferramenta das duas que responde "D7 por coorte de instalação × plano" sem
exportar dado para outro lugar. Manter os dois custa zero de instrumentação
extra — o `track()` do mobile já manda para os dois com uma chamada.

### Estimativa de custo do PostHog em volume

Tabela de preço (product analytics, checada em posthog.com/pricing):

| Volume mensal de eventos | Preço |
|---|---|
| até 1.000.000 | grátis |
| 1M–2M | US$0,05 / 1.000 eventos |
| 2M–15M | US$0,0343 / 1.000 eventos |
| 15M–50M | US$0,0295 / 1.000 eventos |
| 50M–100M | US$0,0218 / 1.000 eventos |

Cálculo de volume: o funil de mobile instrumentado por este PR (§ funis
abaixo) gera algo entre 5 e 15 eventos por usuário ativo por dia, dependendo
de quanto uso de captura/quiz/sala tem naquele dia — chamando de **~8/dia**
como média conservadora fora do dia de onboarding (que sozinho já gera uns
6–8 eventos):

| MAU | DAU (40% hábito) | Eventos/mês (DAU × 8 × 30) | Custo estimado |
|---|---|---|---|
| 10.000 | 4.000 | ~960.000 | **grátis** (dentro do 1M) |
| 25.000 | 10.000 | ~2.400.000 | ~US$48/mês (1,4M acima do free tier a US$0,0343/1k) |
| 100.000 | 40.000 | ~9.600.000 | ~US$295/mês |

Leitura: no volume de lançamento (dezenas de milhares de usuários), o custo
é zero ou de dezenas de dólares por mês — desprezível perto do que custa
*não* saber por que as pessoas somem depois da primeira sessão. O ponto em
que vale reavaliar (negociar plano ou aparar volume de evento) é acima de
~50–100k MAU. Session Replay e Feature Flags do PostHog têm cota grátis
separada (5k gravações/mês, 1M flag requests/mês) e não estão em uso — não
somam ao custo acima.

### O que falta para o servidor também mandar para o PostHog

Hoje o lado API só loga estruturado (§2) — de propósito, para não integrar
uma chamada de rede nova sem aprovação explícita. O próximo passo, **quando
aprovado**, não precisa de SDK nem de dependência nova: o endpoint de
captura do PostHog é HTTP simples
(`POST https://us.i.posthog.com/capture/` com a mesma chave de projeto que
já está em `eas.json`), then o `fetch` embutido do Node 18+ resolve. Isso é
uma mudança de uma função dentro de
`apps/api/src/analytics/analytics.service.ts`, não um projeto novo.
