# `study-timer` — o cronômetro que aparece fora do app

Módulo nativo local. Uma API em JS, duas implementações que **não são
equivalentes** — e a diferença importa mais do que parece.

| | Android | iOS |
|---|---|---|
| Mecanismo | Foreground Service | Live Activity (ActivityKit) |
| Mantém o processo vivo? | **Sim** | **Não. E nada mantém.** |
| Mantém o heartbeat batendo? | Sim | Não |
| Mostra cronômetro na tela de bloqueio | Sim | Sim |
| Botões de pausar / encerrar | Sim | Sim |
| Mínimo | API 24 (serviço tipado a partir da 34) | iOS 16.1 |

## A assimetria

No Android o Foreground Service é a única forma de manter o processo — e
portanto o runtime JS, e portanto o heartbeat de 30s — vivo quando o usuário
troca de app. Sem ele o Android congela o processo em um ou dois minutos, o
heartbeat para, e cinco minutos depois o servidor varre a sessão. O usuário
estudou duas horas e recebe crédito por quatro minutos.

No iOS **não existe equivalente**. Nenhum. Não é falta de esforço de engenharia:
o sistema não oferece execução indefinida em segundo plano para este tipo de
app, e não vai oferecer.

Então a Live Activity não é o mecanismo — é o mostrador. O timer dela é um
`Text(timerInterval:)`, que o próprio sistema avança a partir de um instante de
referência, sem runtime nosso. Por isso `StudyTimerAttributes.ContentState`
carrega *timestamps*, não uma contagem: se fosse contagem, alguém teria que
atualizá-la, e não há ninguém.

## O que realmente protege o tempo do usuário

Nos dois sistemas: **o servidor.** Ele mede a duração e, se o heartbeat parar,
credita a sessão até o último batimento em vez de descartá-la
(`docs/API-SESSIONS.md` §5).

Este módulo melhora a visibilidade e, no Android, a longevidade. Ele não é a
rede de proteção. Essa distinção é o que permite que toda chamada em
`services/study-timer.ts` engula o próprio erro: se a notificação falhar, o
usuário perde o mostrador, não o tempo de estudo.

## Fabricantes que matam serviço mesmo assim

Xiaomi/MIUI, Huawei, Oppo, Vivo, Samsung e companhia param foreground services
ignorando o contrato documentado. Não existe API para perguntar "seu OEM vai me
matar" — a isenção de otimização de bateria é a aproximação mais próxima que
existe, e nesses aparelhos ela costuma vir desligada.

`getBatteryWarning()` detecta o caso e `session/setup.tsx` pede a isenção **uma
vez por instalação**, antes da primeira sessão. Errar para o lado de perguntar é
barato; o silêncio num Xiaomi custa horas de estudo e a culpa cai no app.

## O que foi verificado

Compila. `expo prebuild -p ios` gera o target `QuiblyWidget`, o Xcode lê o
projeto (`xcodebuild -list` mostra os dois targets) e
`xcodebuild -scheme QuiblyWidget -sdk iphonesimulator` produz o `.appex`.

Dois bugs reais saíram desse teste, que revisão de código não tinha pego:

1. `.foregroundStyle(.quiblyLime)` não compila — em `foregroundStyle` o
   compilador infere `ShapeStyle`, não `Color`, e não acha a extensão estática.
   Precisa ser `Color.quiblyLime`.
2. O plugin prefixava o caminho das fontes com o nome do target, mas o grupo do
   Xcode já carrega esse path. Resultado: `QuiblyWidget/QuiblyWidget/Foo.swift`
   e `Build input files cannot be found`.

## O que continua não verificado

Nada aqui foi executado em aparelho. O comportamento que este módulo existe para
garantir — a sessão sobreviver ao app ser morto, o cronômetro aparecer na tela de
bloqueio, os botões da notificação chegarem ao JS — **não se reproduz em
simulador**, e o próprio prompt da tarefa diz isso
(`docs/prompts/F1-mobile-timer-vivo.md`).

Falta, e precisa de aparelho físico com dev build:

1. Android: sessão sobrevive a trocar de app e voltar depois de 10+ minutos
2. Android: notificação com cronômetro correndo e ações funcionando
3. Android: comportamento num Xiaomi ou Samsung real, com e sem a isenção
4. iOS: Live Activity aparece na tela de bloqueio, o timer corre sozinho
5. iOS: Dynamic Island (só do iPhone 14 Pro para cima) e as ações de deep link

## Risco conhecido: o tipo compilado duas vezes

`StudyTimerAttributes.swift` é compilado no app (via o Pod do módulo Expo) **e**
na extensão. O ActivityKit casa os dois lados pelo *nome* do tipo, não pelo
módulo, então na prática funciona — é o arranjo que a maioria dos projetos usa.

Mas é frágil: se as duas cópias divergirem em um campo, o sistema recusa a
atividade **em silêncio, sem erro de compilação**. Se a Live Activity não
aparecer no aparelho, é o primeiro lugar para olhar.

A alternativa robusta é um framework compartilhado entre os dois targets. Vale
fazer se este arranjo der problema, não antes.
