# A ficha das lojas

O que preencher no App Store Connect e no Play Console, e de onde cada resposta
saiu. Escrito em 08/08/2026, lendo o código — não é estimativa.

> **Nada aqui é decisão final de negócio.** Preço, nome público e categoria são
> do dono do produto. O que este documento garante é que as respostas de
> privacidade batem com o que o app **faz**, porque declarar errado ali é
> reprovação na revisão e, se passar, é problema de outra ordem.

---

## 1. Formulário de privacidade da Apple

A Apple pergunta, para cada tipo de dado: **é coletado?**, **está ligado à
identidade da pessoa?**, **é usado para rastreamento?**, e **para quê?**

Levantado de `prisma/schema.prisma` (modelo `Profile`, `FeedPost`,
`ChatMessage`, `PushToken`), de `lib/analytics.ts` e de `lib/sentry.ts`.

### Coletado, e ligado à identidade

| Tipo | Onde nasce | Para quê |
|---|---|---|
| **E-mail** | Sign in with Apple / Google → `Profile.email` | Funcionalidade, gestão de conta |
| **Nome** | `Profile.username`, `Profile.handle` | Funcionalidade (aparece no ranking e no feed) |
| **Fotos** | Check-in e avatar → `FeedPost.photoUrl`, `Profile.avatarUrl` | Funcionalidade |
| **Outro conteúdo do usuário** | Legendas, mensagens de chat, bio | Funcionalidade |
| **ID de usuário** | UID do Firebase | Funcionalidade, análise |
| **Histórico de compra** | RevenueCat → `Profile.plan`, `subscriptionStatus` | Funcionalidade |
| **Dados de uso** (interação com o produto) | PostHog | Análise |
| **Diagnóstico** (falhas, desempenho) | Sentry | Análise |

O diagnóstico entra como **ligado à identidade** porque `lib/sentry.ts` chama
`Sentry.setUser({ id })`. O `beforeSend` reduz o usuário ao id e passa mensagem
e `extra` por um scrubber — mas o id continua lá, e é o id que define a
resposta.

### Não coletado

Localização (nem aproximada), contatos, saúde, informações financeiras, dados
sensíveis, histórico de navegação, histórico de busca, áudio, vídeo.

Sobre financeiro: a compra acontece dentro da Apple. O app recebe do RevenueCat
o **estado** da assinatura, nunca meio de pagamento — nenhum número de cartão
passa por qualquer código nosso.

### Rastreamento (App Tracking Transparency)

**Hoje: NÃO.** Nenhum dado sai para publicidade nem é cruzado com dados de
outras empresas. PostHog e Sentry são nossos, para o produto funcionar e para
achar defeito.

> **O dia em que o AdMob entrar, esta resposta vira SIM** — e junto com ela vem
> o prompt de ATT, o `NSUserTrackingUsageDescription`, e uma nova submissão da
> ficha de privacidade. É o segundo motivo, independente do primeiro, para o
> anúncio não entrar na versão de estreia: o primeiro era não confundir quem
> chega; este é não trocar a classificação de privacidade do app na semana do
> lançamento.

### Exclusão de conta

A Apple exige, desde 2022, que dê para excluir a conta **dentro do app**.
Existe: `(tabs)/profile.tsx` → `deleteAccount()` → `DELETE /users/me`. Há também
a página `/delete-account` no site, que é o que a Apple pede como caminho
alternativo público.

---

## 2. Conta de teste para a revisão

**É a reprovação mais comum que existe** e não tem nada a ver com o app: o
login é só Apple e Google, o revisor não consegue entrar, e ele reprova sem
avaliar mais nada.

Em *App Review Information* → *Sign-In Required*, vai um usuário de verdade.
Sign in with Apple aceita conta de teste do App Store Connect (Sandbox), mas o
caminho mais curto é uma conta Google comum, criada para isso, já com:

- pelo menos duas salas, uma delas com desafio ativo
- algumas fotos de check-in e mensagens no chat, para o feed não estar vazio
- sequência de alguns dias, para o mapa de constância mostrar algo

Feed vazio faz o revisor concluir que o app não faz nada.

---

## 3. Telas para a loja

### Tamanhos exigidos

| Loja | Obrigatório |
|---|---|
| App Store | 6,9" (1290×2796) — o iPhone 17 Pro Max serve |
| App Store | 6,5" (1242×2688) só se você quiser cobrir aparelhos antigos |
| Play Store | Telefone: 2 a 8 imagens, mínimo 1080px no lado maior |
| Play Store | Ícone 512×512 e capa 1024×500 |

A Apple aceita só o 6,9" e redimensiona para os demais. Uma resolução só,
portanto.

### As seis telas, na ordem em que contam a história

1. **A abertura** — a cidade com o coelho. É a única que vende antes de
   explicar.
2. **A sala** — feed com fotos de check-in e a faixa de quem está estudando
   agora. É o produto.
3. **O timer rodando**, com a Live Activity visível na tela de bloqueio. É o
   que nos separa do GymRats.
4. **O ranking** do desafio, mostrando dias e não minutos.
5. **O mapa de constância** no perfil.
6. **O chat** da sala.

> **Bloqueio conhecido:** eu não consigo produzi-las. O app precisa estar
> logado, o login é só Apple/Google, e eu não digito credencial. O caminho
> curto é você capturar as seis no aparelho, com o build 46, e eu emolduro,
> ordeno e escrevo as legendas.

---

## 4. Ficha

### Subtítulo (30 caracteres, App Store)

- **pt-BR** — Estude junto. Todo dia.
- **en** — Study together. Every day.

### Descrição

**pt-BR**

> Quibly transforma estudar sozinho em estudar com gente.
>
> Crie uma sala, chame quem estuda com você e comecem um desafio. Cada sessão
> de estudo conta, cada foto de check-in aparece no feed, e o ranking mostra
> quem apareceu — não quem estudou mais horas num dia só.
>
> **Cronômetro que não depende do app aberto.** O tempo é medido no servidor.
> Feche o app, atenda o telefone, deixe o celular de lado: a sessão continua, e
> a Live Activity mostra ela na tela de bloqueio e na Dynamic Island, com
> pausar e encerrar ali mesmo.
>
> **Constância, não recorde.** O ranking conta dias com presença. Um dia leve
> não apaga a sua sequência, e ninguém ganha por virar a noite uma vez.
>
> **A sala é sua.** Foto de capa, nome, prazo. Convide por link.
>
> Grátis para até três salas suas. Participar das salas dos outros é sempre
> ilimitado.

**en**

> Quibly turns studying alone into studying with people.
>
> Create a room, invite the people you study with, and start a challenge. Every
> study session counts, every check-in photo lands in the feed, and the ranking
> shows who showed up — not who crammed the most hours into one day.
>
> **A timer that doesn't need the app open.** Time is measured on the server.
> Close the app, take a call, put the phone down: the session keeps running,
> and the Live Activity shows it on your lock screen and in the Dynamic Island,
> with pause and finish right there.
>
> **Consistency, not records.** The ranking counts days you showed up. A light
> day doesn't erase your streak, and nobody wins by pulling one all-nighter.
>
> **The room is yours.** Cover photo, name, deadline. Invite by link.
>
> Free for up to three rooms of your own. Joining other people's rooms is
> always unlimited.

### Palavras-chave (100 caracteres, App Store, separadas por vírgula sem espaço)

- **pt-BR** — `estudo,foco,pomodoro,cronometro,concurso,enem,vestibular,rotina,grupo,amigos,meta,habito`
- **en** — `study,focus,pomodoro,timer,exam,college,routine,group,friends,streak,habit,accountability`

Não repita palavras que já estão no nome ou no subtítulo — a Apple indexa os
três juntos, e repetir desperdiça caracteres.

### Categoria

Educação, com Produtividade como secundária.

### Classificação etária

4+. Mas o app tem **chat entre usuários e fotos enviadas por usuários**, então
o questionário vai perguntar sobre conteúdo gerado por usuário. Responda que
sim — e a Apple vai exigir, pelo Guideline 1.2, que exista um jeito de
**denunciar conteúdo e bloquear usuário**.

> **Isto pode ser o bloqueio de verdade da segunda-feira.** Não achei nada
> disso no código. Vale conferir antes de submeter: app com feed e chat sem
> denúncia nem bloqueio é reprovação por 1.2, e é uma reprovação que custa dias
> de ida e volta.
