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

## O que não foi verificado

Nada aqui foi executado em aparelho. O comportamento que este módulo existe para
garantir — a sessão sobreviver ao app ser morto, o cronômetro aparecer na tela de
bloqueio, os botões da notificação chegarem ao JS — **não se reproduz em
simulador**, e o próprio prompt da tarefa diz isso
(`docs/prompts/F1-mobile-timer-vivo.md`).

Falta, e precisa de aparelho físico com dev build:

1. Android: sessão sobrevive a trocar de app e voltar depois de 10+ minutos
2. Android: notificação com cronômetro correndo e ações funcionando
3. Android: comportamento num Xiaomi ou Samsung real, com e sem a isenção
4. iOS: Live Activity aparece, o timer corre sozinho, as ações chegam
5. iOS: a extensão de widget precisa ser criada como target do Xcode — ver abaixo

## Pendência conhecida: o target da Live Activity no iOS

`StudyTimerModule.swift` e `StudyTimerAttributes.swift` compilam junto com o app.
Mas a Live Activity só **renderiza** se existir uma Widget Extension declarando
uma `ActivityConfiguration` para `StudyTimerAttributes`, e uma extensão é um
target novo no Xcode — não um arquivo solto.

Criar esse target por config plugin (para sobreviver ao `prebuild`, como o prompt
exige) significa manipular o `.pbxproj`. Não fiz, porque não tenho como compilar
e verificar o resultado, e um plugin de pbxproj quebrado é pior que a ausência
dele: quebra o build inteiro em vez de só a Live Activity.

Enquanto isso não existe, no iOS o comportamento é: a sessão continua correta
(servidor + heartbeat), `Activity.request` falha silenciosamente e o usuário
simplesmente não vê o cronômetro na tela de bloqueio. Degrada, não quebra.
