# Pedido da entitlement Family Controls

Formulário: **developer.apple.com/contact/request/family-controls-distribution**

> ## ⏱️ Por que isto é urgente e mesmo assim não entra na estreia
>
> A `com.apple.developer.family-controls` exige aprovação manual da Apple e
> costuma levar **semanas**. Sem ela, um app que declara a capability é
> **rejeitado na submissão** — funciona em desenvolvimento e não passa na
> revisão.
>
> Ou seja: o pedido tem que sair **agora**, e o bloqueio de apps **não** entra
> na versão que vai para a loja. As duas coisas são verdade ao mesmo tempo, e
> confundi-las é o que faz a Apple virar gargalo de lançamento.
>
> Enquanto ela não chega, a promessa honesta do produto é a que o
> `PLATFORM-CONSTRAINTS.md` já fixou: no Android o Quibly liga o Não Perturbe
> de verdade; no iOS, a Live Activity mantém a sessão à vista. **Nada de "ativa
> o Foco no iPhone"** — o iOS não permite isso a um app de terceiro, e prometer
> é criar uma expectativa que o sistema não deixa cumprir.

---

## O que preencher

**App Name**
Quibly

**Bundle ID**
`com.quibly.app`

> Peça também para as extensões. A entitlement vale por App ID, e o widget da
> Live Activity é outro: `com.quibly.app.widget`. Um pedido só que cite os dois
> costuma bastar, mas confira se o formulário aceita mais de um campo.

**App Store URL / App ID**
6760320166

---

## App Description

> Quibly is a group study accountability app. People create a private room with
> the friends they study with, agree on a challenge, and check in by running a
> study timer or posting a photo of their desk. The ranking counts the days
> each person showed up, not the hours they crammed in one night.

---

## Why your app needs Family Controls

Este é o campo que decide. A Apple aceita **autolimitação** — a pessoa
restringindo o próprio aparelho — e recusa qualquer coisa que pareça vigilância
de terceiros ou coleta de dados de uso. O texto abaixo é escrito para deixar
isso explícito nas três primeiras linhas.

> Quibly users choose to block their own distracting apps during a study
> session they started themselves. The restriction is self-imposed and
> self-limited: the person picks which apps to block, the block lasts only for
> the duration of that session, and they can end it at any moment from the
> shield screen without a password, a delay, or any other friction.
>
> We use the framework in the narrowest way it allows:
>
> - **FamilyControls** — to request authorization for the user's own device and
>   to present `FamilyActivityPicker`, so the choice of which apps to block is
>   made by the user, inside Apple's own UI. We never see the selection: the
>   `ApplicationToken` values are opaque to us and are stored only on device.
> - **ManagedSettings** — to apply the shield while a study session is running,
>   and to clear it the moment the session ends.
> - **DeviceActivity** — to clear the shield reliably when the session's
>   scheduled end arrives, including when our app is not running.
>
> No usage data is collected, transmitted, or stored off the device. Nothing
> from these frameworks reaches our servers, is used for analytics, or is used
> for advertising. There is no parental-control feature: Quibly does not let
> anyone restrict another person's device, and there is no supervisory role in
> the product at all.
>
> The reason this matters for our users is the core of the product. Quibly is
> about showing up consistently, with friends who can see whether you did. The
> most common reason people fail a study session is the phone in their hand —
> and on iOS the Screen Time APIs are the only mechanism that can actually
> remove that obstacle, rather than just reminding the person that it exists.

---

## Frameworks a marcar

- [x] FamilyControls
- [x] ManagedSettings
- [x] DeviceActivity

---

## O que a Apple vai conferir depois, e que precisa ser verdade

Vale ler como especificação, não como aviso: o que estiver escrito acima passa
a valer no código.

1. **A escolha dos apps é do usuário, pelo `FamilyActivityPicker`.** Uma lista
   nossa de "apps distrativos" contradiz o pedido.
2. **A saída é sempre livre.** Sem senha de resgate, sem espera. Já é decisão de
   produto registrada em `PLATFORM-CONSTRAINTS.md §Decisão de produto`, e agora
   também é o que foi afirmado à Apple.
3. **Nenhum token sai do aparelho.** Nem para a nossa API, nem para o PostHog,
   nem para o Sentry.
4. **Sem papel de supervisor.** Ninguém bloqueia o aparelho de outra pessoa —
   nem o dono da sala.

---

## Depois da aprovação

- Acrescentar a capability no App ID **e** no do widget, e regerar os perfis de
  provisionamento. Declarar a entitlement no config **não** faz isso — foi
  exatamente o que quebrou o App Group do pause em 08/08.
- `react-native-device-activity` (kingstinct) é a biblioteca mais completa e tem
  config plugin de Expo.
- Exige dev client próprio: nada disso roda no Expo Go.
- iOS 15+.
