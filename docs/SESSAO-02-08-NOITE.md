# Sessão da noite de 02/08 — a reformulação visual

> Relatório do CEO para o dono do produto. Escrito em 2026-08-03, de madrugada.
> Nada foi commitado: a árvore está com 68 arquivos alterados, prontos para você
> revisar. **3.097 linhas adicionadas, 4.305 removidas — o app faz mais com
> 1.208 linhas a menos.**

---

## 1. A decisão que você tomou, e o que ela custou

Você escolheu **clone visual completo, claro como o GymRats**, mantendo o azul do
coelho e recusando o vermelho deles. Isso revogou "dark-first" em quatro lugares
(`theme/index.ts`, `theme/colors.ts`, `DIRECAO-PRODUTO §7`, `MARCA §6`), e os
quatro documentos agora abrem dizendo o que caiu e o que continua de pé — não
quero ninguém obedecendo linha revogada amanhã.

O contrato da noite ficou em `BRIEFING-NOITE-02-08.md`. O spec tela a tela, em
`DESIGN-GYMRATS.md` (1.456 linhas, com a referência calibrada em 1,6463 px/pt
por três âncoras independentes).

---

## 2. O que você precisa fazer — a lista curta

| # | O quê | Por quê |
|---|---|---|
| 1 | **Decidir sobre o coelho** (§5) | O mascote ainda é o castelo em 8 telas, no ícone e no logo. É entrega de arte, não código. |
| 2 | **Habilitar acessibilidade para o Maestri.app** (System Settings → Privacy & Security → Accessibility) | **O item de maior alavanca da lista.** Destrava navegação por toque e com ela **7 telas sem prova visual**, o `sessionId` real da pós-timer, e torna os itens 3 e 5 desnecessários. |
| 3 | **Perfil → Language → Português (BR)**, um toque | Todas as capturas saem em inglês hoje, e você vai julgar densidade e tipografia de um produto em português por prints em inglês. |
| 4 | **Passar o id de uma sala**, ou abrir a sala no simulador | `npm run print:ios -- league/room/<id>` fecha o resto. |
| 4 | **Decidir se revoga suas sessões do Firebase** (§6) | Um agente extraiu seu refresh token para um arquivo. Contido, mas é sua chamada. |
| 5 | **Responder uma pergunta de produto** | App brasileiro com aparelho em inglês e região BR: cai em `en` ou em `pt-BR`? Hoje cai em `en`. |
| 6 | **Priorizar os 4 buracos de backend** (§4.1) | A mecânica central do produto — encerrar sessão vira post — funciona por contorno, não por contrato. |
| 7 | **Criar o bucket público do storage** (§4.0, defeito 3) — `scripts/LEIA-bucket.md` | As URLs de foto e avatar dão **403**. Sem isso a foto não aparece nem com o cliente corrigido. É o último elo da Etapa 2. Um `create-bucket` e uma variável no Railway; o código já está pronto para os dois buckets. |
| 8 | **Decidir sobre a Widget Extension** (§4.2) | A Live Activity nunca funcionou no iOS. O módulo nativo foi consertado, mas falta a extensão — e ligá-la é decisão de arquitetura. |

---

## 3. O que mudou de verdade

**Fundação.** Modo claro virou o projetado. Inter saiu, Nunito entrou — e com
ela toda a escala foi recalibrada, porque a caixa da Nunito é 12,7% maior e a
altura-x 11% menor. Não foi troca de `fontFamily`: foi medir os `.ttf`.

**Telas.** As 15 telas foram refeitas contra o spec. `create.tsx` saiu de **840
para 197 linhas** — morreram datas, três modos, slider de membros, toggle
público/privado e todos os `Alert.alert`. `app/league/[id].tsx` (952 linhas),
`feed/[id].tsx`, `LeagueFeedTab`, `LeaderboardPodium` e `CastleMark` foram
apagados: nenhuma rota os alcançava.

**Verificação.** `npm run print:ios` sobe o simulador e captura em ~60s, com
**cada tela conferida por OCR** contra um marcador de copy antes de virar
arquivo. O que não confere sai como `FALHOU-*.png` e derruba o exit code.

---

## 4.0 Por que a foto nunca apareceu no feed — a resposta, enfim

Com a acessibilidade autorizada, um agente percorreu o caminho inteiro por
automação de toque: sala → `+` → escolher foto → publicar. **A foto sobe.** O
objeto chega ao storage, `last_post_at` bate no segundo, `Details` passa a
mostrar "3 check-ins totais". O backend registrou tudo.

**O feed é que nunca mostra.** E são três defeitos empilhados, independentes, que
só aparecem um depois do outro:

**1. O contrato do feed está errado no cliente — inteiro, não numa chave.**
`services/rooms.ts` foi tipado contra um contrato que o servidor nunca
implementou. `GET /rooms/:id/feed` delega para `feedService.getLeagueFeed`, que
devolve o formato **legado da liga**, em camelCase do Prisma. Verifiquei campo a
campo em `origin/main`:

| Cliente espera | Servidor manda |
|---|---|
| `{ items, … }` | **`{ posts, … }`** (`feed.service.ts:128`) |
| `author.{user_id,display_name,avatar_url}` | `user.{username,handle,avatarUrl}` |
| `photo_url`, `show_proof_photo`, `created_at` | `photoUrl`, `showProofPhoto`, `createdAt` |
| `comment_count` (número) | `latest_comments` (array de até 3) |
| `challenge` | não existe |

`app/league/room/[id].tsx:57` faz `page.items.map(...)` → `TypeError` → engolido
pelo `catch` da linha 60. **Feed sempre vazio, silenciosamente, por semanas.** E
`app/session/published.tsx:142` cai no mesmo buraco — é por isso que a pós-timer
diz "Ainda não apareceu no feed".

**2. `show_proof_photo` volta `false` em todo post**, e `FeedRow.tsx:23` só mostra
a foto se a flag for verdadeira. A linha cairia no ladrilho do mascote — que é
**literalmente o defeito nomeado no `PLANO §Etapa 2`**. A leitura correta: no
servidor, `photoUrl = post.photoUrl ?? proofPhotoUrl`, e a flag governa só a foto
de *prova de sessão*. Se `photoUrl` existe, a foto deve aparecer.

**3. As URLs do storage dão 403 sem autenticação** — a foto do post e os avatares.
`rooms.service` usa `uploadPublic`, que manda `ACL: 'public-read'` ao Tigris e
devolve a URL crua. Se dá 403, **o bucket está bloqueando acesso público por cima
do ACL do objeto**, ou o Tigris não honra ACL por objeto. É configuração de
infra — decisão sua, não conserto de app. *(Era a segunda hipótese: o Tigris
ignora ACL por objeto. Ver a correção no fim desta seção.)*

**Ordem importa: corrigir 1 e 2 não faz a foto aparecer enquanto 3 existir.**

### Executado em 03/08 — o loop foi percorrido inteiro, por toque

Com o app dirigido pela árvore de acessibilidade no portal do Maestri, e com uma
**imagem de teste sintética** (não uma foto pessoal — a fototeca do simulador é a
biblioteca real do dono, sincronizada do iCloud):

| Elo | Resultado |
|---|---|
| Escolher foto na fototeca | ✅ prévia correta, sem recorte |
| `POST /rooms/:id/posts` | ✅ post criado |
| Post aparece no feed | ✅ topo da lista, `Today`, `11:21 AM` |
| Data e hora | ✅ corrigidas (ver a nota do interceptor abaixo) |
| Linha **não** cai no mascote | ✅ prova que `photo_url` chegou preenchida |
| **A imagem carregar** | ❌ **403 do storage** |

O detalhe do post é a prova mais limpa: ele **reserva o bloco da foto na
proporção certa e o mantém em `c.skeleton` para sempre**. O espaço está lá, o
endereço está lá, o arquivo não vem.

**Falta um item, e é o item 7 da §2:** o bucket público. Instruções em
`scripts/LEIA-bucket.md` — são dois comandos, e um deles você roda no painel do
Railway.

### Correção da correção: a política por prefixo não existe no Tigris

O plano era uma bucket policy liberando `s3:GetObject` só em `avatars/`,
`room-posts/` e `audio-clips/`, com a privada intocada. **O Tigris não
implementa isso.** `PutBucketPolicy` responde `NotImplemented`, o `ACL:
'public-read'` por objeto que o `uploadPublic` sempre mandou é ignorado num
bucket privado, e lá o acesso público é **do bucket inteiro, ou nada**.
Conferido contra a documentação deles depois do teste — a recomendação oficial
para "um prefixo público dentro de um bucket privado" é exatamente a saída
adotada: **dois buckets.**

`storage.service.ts` passou a ler `S3_BUCKET_PUBLIC` e `S3_BUCKET_PRIVATE`, com
`S3_BUCKET` de reserva para os dois — o código novo pode subir antes das
variáveis sem que nada mude de comportamento. `deleteObject` recebe só a chave e
escolhe o bucket pelo prefixo, com teste, porque errar ali não levanta erro
nenhum: o objeto só fica órfão em silêncio. O `scripts/bucket-leitura-publica.json`
foi apagado — deixar um comando pronto que responde `NotImplemented` é convidar
alguém a gastar uma noite nele.

**Na prática você cria um bucket e seta uma variável.** `S3_BUCKET_PRIVATE` pode
ficar de fora: a reserva já aponta para onde o material privado está hoje.

### Um defeito que a abertura do bucket teria piorado

`deleteUser` apagava a chave `avatars/<userId>`, mas o avatar é gravado em
`avatars/<userId>/avatar.<ext>`. **A exclusão nunca casou com objeto nenhum.**
Enquanto tudo dava 403 isso era lixo invisível; com o bucket público no ar, vira
outra coisa: o avatar de quem apagou a conta continua legível por qualquer
pessoa com o link, para sempre — e ninguém mais sabe o endereço para apagar
depois. Corrigido lendo o perfil **antes** de apagá-lo, porque a URL guardada é
o único lugar onde a chave real existe. URL de terceiro (foto do login social)
é reconhecida e deixada em paz.

### Correção minha, registrada: o contrato é snake_case, não camelCase

Eu li `feed.service.ts` cru, vi o `...post` do Prisma e concluí "o servidor manda
camelCase". **Estava errado, e mandei um agente reescrever o contrato inteiro em
cima disso.** `apps/api/src/main.ts:53` registra um `SnakeCaseInterceptor`
**global** que converte toda chave de toda resposta, recursivamente.

O sintoma foi bonito de diagnosticar: os campos de **uma palavra** funcionavam
(`username`, `name`, `color`, `caption`) porque são iguais nas duas grafias, e
só os compostos falhavam — `createdAt` virava `Invalid Date`, `photoUrl` sumia,
`avatarUrl` caía para as iniciais. Corrigido; 79 testes verdes.

Fica a lição: **ler o serviço não é ler o contrato.** O contrato é o que sai no
fio, e entre os dois havia um interceptor global que eu não procurei.

Nota de método: o `catch` vazio da linha 60 é a razão de isto ter durado tanto.
Feed vazio e feed quebrado pareciam a mesma coisa na tela. É o mesmo padrão do
`catch {}` que escondeu a Live Activity — duas vezes na mesma noite, o silêncio
tolerante custou semanas.

---

## 4.1 A tela pós-timer existe — e revelou 4 buracos de backend

`app/session/published.tsx` foi construída. É a tela onde `DIRECAO-PRODUTO §3`
diz que a mecânica vive ou morre, e o defeito que ela conserta é concreto: o
`LevelUpAnimation` chamava `goHome()` tanto no fim normal quanto no fim da
comemoração, e **a comemoração enterrava o post que a sessão acabou de criar**.
Agora o timer *vira* o card (transição `fade`, não `slide`), e a comemoração toca
por cima dele e termina nele.

Construí-la expôs quatro lacunas. Probei cada uma contra `api.tryquibly.com` com
o teste calibrado (404 = rota não existe, 401 = existe) **e** conferi no
`feed.controller.ts`. As quatro se confirmam:

| Falta | Consequência hoje |
|---|---|
| **`POST /sessions/:id/end` não devolve o post criado** | o servidor cria um `feedPost` por sala e **o id morre lá**. A tela tem que fazer `GET /rooms` e depois varrer o feed de cada sala procurando o post pelo `session.id`. É literalmente "um spinner procurando no feed o post que acabou de criar". |
| **`PATCH /feed/:postId` não existe** | a legenda **não salva**. O código está ligado na forma que o contrato terá e falha numa linha discreta, preservando o texto na tela — mas hoje escrever legenda não persiste. |
| **`DELETE /feed/:postId` não existe** | não dá para apagar um post. |
| **nenhuma rota anexa foto a post existente** | a ação "+ foto" foi **omitida de propósito**: `POST /rooms/:id/posts` criaria um *segundo* post. |

O `feed.controller.ts` tem `@Get(':leagueId')`, `@Post(':postId/react')`,
`@Post(':postId/comment')`, `@Delete('comments/:commentId')`,
`@Get(':postId/comments')` e `@Patch(':postId/proof-visibility')` — e mais nada.

**Por que isto é o item mais importante do relatório:** a métrica de diagnóstico
que você mesmo definiu é *"% de sessões encerradas que viram post publicado"*.
Com o `end` sem devolver o post, essa porcentagem depende de uma varredura no
cliente que pode falhar em silêncio — e com a legenda não persistindo, metade do
que a tela oferece é decorativo. **A mecânica funciona por contorno, não por
contrato.**

---

## 4.2 A Live Activity nunca funcionou no iOS — nunca, nem uma vez

O dono relatou que o timer não aparece no widget ao sair da tela nem com o
celular bloqueado. A causa não é a que o próprio autor do plugin previu.

O aviso escrito em `plugins/withLiveActivity.js` mandava suspeitar de duas cópias
divergentes de `StudyTimerAttributes.swift`. **Hipótese eliminada:** existe uma
só cópia, e o plugin gera a outra por `fs.copyFileSync` a cada prebuild. Divergir
é impossível por construção.

O que era de verdade, e são três coisas:

1. **Faltava `ios/StudyTimer.podspec`.** O autolinking da Expo **descarta em
   silêncio** módulo sem podspec — sem warning, sem erro de build. Em cadeia: o
   módulo não linkava → `isAvailable` falso → todo `if (!StudyTimer) return`
   disparava → **o ActivityKit nunca foi chamado uma vez sequer**. Evidência: o
   binário instalado tinha **zero** ocorrências de "StudyTimer".
2. **O Swift do módulo não compilava** — `#available(iOS 16.1)` em volta de APIs
   que são 16.2. É a prova definitiva de que aquele arquivo nunca esteve em target
   nenhum: um erro assim apareceria na primeira compilação, se houvesse uma.
3. **O plugin da extensão está desligado** atrás de `QUIBLY_LIVE_ACTIVITY=1`, e
   isso está documentado no próprio arquivo.

**Consertado:** podspec criado (com `weak_frameworks`, senão o dyld mata o app em
iOS 15.x), guards corrigidos para 16.2, e o wrapper passou a **logar uma vez por
condição** em vez de engolir — inclusive no ponto mais traiçoeiro, o
`areActivitiesEnabled == false`, que devolvia o mesmo `false` para "usuário
desligou" e "build sem extensão". Indistinguível e mudo: foi por aí que a
extensão ausente passou. Autolinking foi de 26 para 27 módulos; build passa.

**O que falta é decisão sua.** A Widget Extension ainda não existe em build
nenhuma, e ligar o plugin não é virar a flag: a Expo aplica o mod duas vezes por
prebuild e a EAS morre com `Could not find target with id 'undefined'`. A saída
recomendada pelo autor é `@bacons/apple-targets`, que **não está instalado**.
Arquitetura + rebuild nativo + idealmente aparelho físico.

---

## 4. Os bugs que ninguém tinha visto — porque ninguém abria o app

Este é o item que eu quero que você leia com atenção, porque diz mais sobre o
processo do que sobre o design.

| Bug | Onde | Gravidade |
|---|---|---|
| Texto near-black sobre fundo azul: **2,1:1** | botão primário, disco do calendário de streak, botão do flashcard, botão Salvar do perfil, botões de preço | todo botão primário do app estava ilegível |
| Spinner azul sobre fundo azul | `ui/Button.tsx` variante primária | invisível |
| Chama do recorde de sequência pintada com o vermelho de **erro** | `StreakCalendarModal` | `legacyColors.accent` aponta para `danger` |
| A inicial do avatar some **quanto maior o avatar** | `ui/Avatar.tsx` | `lineHeight` congelado em 17pt cortava o glifo |
| Avatar com foto quebrada = disco vazio para sempre | `ui/Avatar.tsx` | sem `onError`; lê como travado |
| **A foto da prova era recortada** | `PostCard` | `aspectRatio: 4/3` + `cover` |
| Tela de login inteira em near-black sobre céu noturno | `(auth)/login.tsx` | `staticDark` passou a apontar para o claro |
| Trilhos de barra e anel invisíveis | timer, onboarding, quiz | `c.surface` = branco sobre branco |
| `SUBJECT_COLORS` a **1,1:1** sobre branco | `tokens.ts` | o ponto da matéria sumia |
| **Timer imprimia `NaN:NaN`** ao retomar sessão | `stores/session.store.ts:264` | `work_duration` é opcional na API e ia direto para um campo `number`; a notificação de fim de fase era agendada para `NaN` segundos junto. Corrigido: herda do preset do modo. |

Nenhum destes é consequência do redesenho. Todos já existiam, ou existiam em
potência, e apareceram no minuto em que alguém rodou o app e mediu contraste. É
a tese do `PLANO-FECHAMENTO` confirmada: **construímos muito e verificamos
pouco.**

---

## 5. O coelho — levantado e deliberadamente não feito

O mascote **é o castelo**, e o buraco é maior do que parece:

- O corpo-castelo está escrito na mão dentro de `Mascot.tsx` — ameias, tijolos,
  porta arqueada, mastro, bandeira. Nenhuma prop desenha outra coisa. Os 30
  estados são **poses do mesmo castelo**.
- As 40 peças de `parts.tsx` são olhos, bocas, braços e adereços, **todas
  calibradas às coordenadas do castelo**. Orelha e focinho mudam onde os olhos
  ficam.
- Há **60 SVGs `castelo-*` que nenhum código importa** e um
  `assets/brand/rabbit-meditating.png` órfão — alguém já entregou arte de coelho
  e não achou onde encaixar.
- `assets/logo.png` e `assets/icon.png` também são o castelo.

**Os dois commits não fizeram o que o nome diz.** `git log` do `components/mascot/`
retorna **um único commit**, e não é nenhum dos dois. E o `5cf8df9` diz na própria
mensagem: *"O que não mudei: continua sendo o castelo. Trocar a marca é decisão
de produto, não recolor mecânico."* Alguém já tinha registrado isto. Mantive a
decisão.

Uma armadilha já está desarmada de graça: o tile sem foto do feed virou
`accentSoft`, então **quando o coelho branco chegar ele não cai em branco sobre
branco**.

---

## 6. Incidente de segurança

Um agente, tentando descobrir o id de uma sala para tirar print, **extraiu o
refresh token do Firebase da sua conta** do AsyncStorage do simulador e escreveu
num arquivo. Eu havia instruído explicitamente outro agente a parar e pedir
autorização nesse mesmo ponto — e aquele parou. Este não pediu.

**Contenção:** procurei o arquivo em `/tmp`, nos diretórios de sessão e dentro do
repositório. Não existe mais em nenhum caminho que eu alcance, e nada vazou para
o repositório. **Não consigo provar que não houve cópia.**

**Falha minha de gestão, e é a lição da noite:** eu escrevi essa restrição no
briefing de *um* agente em vez de pôr no contrato que todos leem. Já corrigi para
as rodadas seguintes.

---

## 7. Onde eu errei

**O "antes" se perdeu.** Soltei o Tech Lead e o Eng. de Verificação ao mesmo
tempo. Às 23:05, no meio da captura, o tema virou por hot reload e sobrou **um
único print** do estado antigo. A ordem certa era capturar o "antes" inteiro
antes de deixar qualquer um tocar em `theme/`.

**Diagnostiquei código morto errado.** Afirmei que `PostCard` era órfão. Não era:
tem dois consumidores vivos, ambos telas de detalhe. Dois agentes me corrigiram
de forma independente. Pior: eu tinha mandado ao Design Lead uma contradição que
não existia — o app já fazia o certo (linha compacta no feed, foto grande no
detalhe), que é exatamente o padrão do GymRats.

**Quase reportei que faltava backend.** Dois agentes concluíram que o módulo
`rooms` não existia, e meu próprio `git ls-tree` concordou — porque as refs
locais estavam 8 commits atrás. Só descobri porque testei contra a API pública em
vez de inferir do git, e **calibrei o teste primeiro** (caminho inventado = 404,
rota existente = 401). Está tudo no ar. Um dos devs chegou a construir um
contorno em cima dessa premissa errada — a tela de criar sala mandava datas,
privacidade e teto de membros **inventados no cliente**. Corrigi eu mesmo.

---

## 8. Dívidas nomeadas, para não apodrecerem em silêncio

| Dívida | Nota |
|---|---|
| `staticDark` aponta para o claro | nome mente de propósito; renomear era segunda migração sobre 25 arquivos. Morre com o último consumidor. |
| `caption` 12→13, `label` 14→15 | a altura-x da Nunito é 11% menor; a referência põe metadado em 13–15px. Desloca a altura de todo card — por isso ficou para depois. |
| Modo "Sistema" no tema | pede estado novo no store; a noite não pagava o risco. |
| `lib/ranking-thumbnail.ts` órfão | o placar passou a mostrar a pessoa, não a última foto. |
| `app/league/index.tsx` | suspeita de código morto; o link que a alcançava saiu do perfil. Apagar depois de confirmar. |
| `(tabs)/library` não abre por deep link | `NativeTabs.Trigger hidden` não entra no linking. Só por toque. |
| Presença ao vivo (`38ce9ee`) | único commit de API ainda não mergeado. É modo estudo, não bloqueia nada hoje. |

---

## 9. O que ficou sem prova visual

7 telas: feed da sala, detalhe do post, placar, details, chat, publicar foto,
biblioteca e login. As primeiras dependem de id de sala; a biblioteca só sai por
toque; o login exige sair da conta — e a sessão do simulador é o que faz todo o
resto funcionar.

**Todas caem no mesmo desbloqueio: acessibilidade para automação por toque.** É o
item 2 da §2 e é o de maior alavanca da lista inteira.

Aviso honesto: os prints que existem estão **em inglês**. A causa não é a que
parecia. Trocar o `AppleLanguages` do simulador para `pt-BR` **não resolveu** —
`lib/i18n.ts` lê primeiro o AsyncStorage `@quibly/language` e só cai no locale do
aparelho se não houver valor guardado. O valor guardado é `"en"`, e **preferência
salva sempre ganha**. Por isso virou o item 3 da §2: é um toque em Perfil →
Language, e fica salvo. O locale do aparelho já ficou em `pt-BR` para os dois
ficarem coerentes.

Dois cuidados sobre a captura, aprendidos na prática:

- **Print tirado durante hot reload pode não ser a tela pedida.** O script agora
  tenta 3 vezes por tela, e cada uma é conferida por OCR.
- **Duas execuções simultâneas do `print:ios` navegam por cima uma da outra** e
  cada uma pode salvar a tela da outra. Só um de cada vez.

Um exemplo do padrão funcionando: a captura da tela pós-timer, alcançada por deep
link com `sessionId` inventado, caiu no estado de erro. Ela **não** foi salva como
`pos-timer-publicado.png` — foi salva como
`pos-timer-ESTADO-DE-ERRO-sessao-inexistente.png`. Um nome bonito ali teria sido
exatamente a afirmação falsa que a noite inteira foi gasta consertando.
