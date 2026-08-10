# Submissão à App Store — o que preencher, e por quê

Escrito em 10/08/2026, para a primeira submissão do build 65 (1.2.1).

Duas partes: o questionário de privacidade e a nota ao revisor. As duas
reprovam com frequência quando ficam em branco, e nenhuma delas é código — é
por isso que este arquivo existe: elas somem entre uma release e outra.

---

## 1. App Privacy (App Store Connect → App Privacy)

Desde que o AdMob entrou (build 64), este app **rastreia** no sentido que a
Apple define: ele lê o identificador de publicidade e o usa para anúncio
personalizado, o que a Apple chama de tracking. Deixar isso em branco, ou
marcar "não coletamos dados", é uma das rejeições mais comuns que existem — e é
detectável automaticamente, porque o binário linka o `AppTrackingTransparency`.

### Data Used to Track You

Marcar **sim**, e declarar:

| Categoria | Item | Por quê |
|---|---|---|
| Identifiers | **Device ID** (IDFA) | O SDK do AdMob o lê após o consentimento de ATT, para anúncio personalizado. É a definição literal de tracking da Apple. |
| Usage Data | **Advertising Data** | Impressões e cliques voltam ao AdMob associados ao dispositivo. |

### Data Linked to You

| Categoria | Item | Origem no código |
|---|---|---|
| Contact Info | Email | `Profile.email` — conta criada por Firebase Auth |
| Contact Info | Name | `Profile.username` |
| User Content | Photos | Foto de check-in (`FeedPost`) e avatar |
| User Content | Other User Content | Bio, mensagens de chat da sala |
| Identifiers | User ID | UID do Firebase, chave de tudo |
| Usage Data | Product Interaction | PostHog e Firebase Analytics |
| Diagnostics | Crash Data | Sentry |
| Diagnostics | Performance Data | Sentry |
| Purchases | Purchase History | RevenueCat, para o entitlement `pro` |

### Data Not Collected

Não marcar nada em **Location**, **Health & Fitness**, **Financial Info**,
**Contacts**, **Browsing History**, **Sensitive Info**. O app não toca em
nenhum deles — conferir antes de assinar, mas hoje é verdade.

> O pagamento acontece **dentro da Apple**. Nós nunca vemos cartão nem dado
> financeiro; o que chega é o resultado, pela RevenueCat. Por isso *Financial
> Info* fica desmarcado e *Purchase History* marcado.

---

## 2. Nota ao revisor (App Review Information → Notes)

O recurso mais delicado é o bloqueio de apps. A Apple **aprovou** o entitlement
de Family Controls, mas aprovação de entitlement não é aprovação de app: o
revisor precisa achar o recurso e ver que ele se comporta. Sem instrução, ele
reprova por não conseguir avaliar — não por discordar.

O texto abaixo é para colar no campo de notas, em inglês.

```
FAMILY CONTROLS / DEEP FOCUS

Quibly is a study-timer app. The Deep Focus feature blocks distracting apps
for the duration of a study session, using the Family Controls entitlement
that was granted to this app.

How to see it:
1. Open the app and sign in (test account below).
2. Tap the "+" to start a study session.
3. On the setup screen, turn on "Deep Focus".
4. iOS will ask for Screen Time permission — please allow it.
5. Choose which apps stay allowed (we suggest allowing Music), then start.
6. Leave Quibly and try to open a blocked app: a shield appears.
7. Return to Quibly and end the session — the shield is lifted immediately.

The block is bound to the session and cannot outlive it. Four independent
guarantees release it: the session ending, a DeviceActivity schedule running
in a separate process, a reconciliation pass on every app launch, and a
four-hour absolute ceiling. Quibly itself is never blocked, so the user can
always reach the control that ends the session.

The shield is only ever raised after an explicit opt-in on the setup screen,
never by default.

ADVERTISING

The free tier shows a single banner (Google AdMob), between the room stats
and the daily feed. Subscribing to Pro removes it. We request App Tracking
Transparency consent before initialising the ads SDK; declining is respected
and results in non-personalised ads rather than no ads.

ACCOUNT

Sign in with Apple, Google, or email. A test account is provided below.
Account deletion is available in Settings, as the last item on the screen
("Delete Account"), and also on the web at
https://tryquibly.com/delete-account without needing the app.
```

### O que mais preencher ali

- **Conta de teste**: obrigatória, porque o app exige login. Sem ela é rejeição
  imediata, e é a mais boba de todas.
- **Contato**: telefone e email que alguém atende. A Apple liga.

---

## 3. Antes de apertar "Submit for Review"

- [ ] Questionário de privacidade preenchido (seção 1) — **inclui IDFA**
- [ ] Nota ao revisor colada (seção 2)
- [ ] Conta de teste criada, testada e escrita no formulário
- [ ] Capturas de tela 1320×2868 (as três primeiras são as que aparecem sem rolar)
- [ ] **O preço da tela de planos confere com o que a folha da Apple cobra** —
      ver `hooks/useIAP.ts`. Em 10/08 o app mostrava US$ enquanto a cobrança
      saía em R$; a telemetria do build 65 traz o país da vitrine para
      diagnosticar. Isto é o único item aberto que **bloqueia** de verdade: um
      revisor abre a tela de planos.
- [ ] `app-ads.txt` no ar em `tryquibly.com/app-ads.txt` (está)
- [ ] Anúncio servindo com o identificador real, não o de teste (build 65 leva)
