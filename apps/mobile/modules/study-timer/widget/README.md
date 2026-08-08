# `widget/` — fontes que **não** podem entrar no app

O autolinking do Expo compila todo arquivo Swift em `modules/study-timer/ios/`
dentro do target do app. Estes dois não podem ir junto:

`StudyTimerLiveActivity.swift` declara `@main` no `QuiblyWidgetBundle`. O app já
tem `@UIApplicationMain` no `AppDelegate`. Com os dois no mesmo target, o
processo sobe o bundle do widget em vez do React Native — **o app abre e fica
preso na splash para sempre**, sem crash e sem log. Foi exatamente o que
aconteceu na build 22 no TestFlight.

`CoelhoMark.swift` vem junto porque só a Live Activity o usa, e um `View` de
SwiftUI no app sem ninguém para renderizá-lo é peso morto.

`StudyTimerAttributes.swift` **fica em `ios/`** de propósito: `StudyTimerModule`
precisa dele para chamar `Activity<StudyTimerAttributes>`, então o app compila
esse e só esse.

O plugin `withLiveActivity.js` copia daqui para o target da extensão quando
`QUIBLY_LIVE_ACTIVITY=1`.
