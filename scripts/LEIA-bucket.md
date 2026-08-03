# Liberar a foto do feed — criar o bucket público

> Reescrito em 2026-08-03, depois que a rota original morreu na prática.
> **A versão anterior deste arquivo mandava aplicar uma bucket policy por
> prefixo. Não faça isso: o Tigris não implementa.** O porquê está na §2.

## 1. O problema que isto resolve

A foto do post sobe para o storage, o post entra no feed, e a URL da imagem
responde **403**. O detalhe do post é a prova mais limpa: ele reserva o bloco da
foto na proporção certa e o mantém em esqueleto para sempre. O espaço está lá, o
endereço está lá, o arquivo não vem.

Esse é o último elo da Etapa 2 do `PLANO-FECHAMENTO` (tirar foto → aparecer no
feed). O cliente já está corrigido; falta só isto, e é configuração de infra.

## 2. Por que não dá para liberar só os prefixos públicos

O mesmo bucket guarda arquivo privado por desenho:

| Prefixo | Como sobe | Deve ser público? |
|---|---|---|
| `avatars/` | `uploadPublic` (`users.service.ts:64`) | **sim** |
| `room-posts/` | `uploadPublic` (`rooms.service.ts:60`) | **sim** |
| `audio-clips/` | `uploadPublic` (`audio-sessions.service.ts:213`) | **sim** |
| `documents/` | `uploadPrivate` (`documents.service.ts:33`) | **não** |
| `lessons/` | `uploadPrivate` (`lessons.service.ts:69`) | **não** |
| `proof-photos/` | `uploadPrivate` (`proof-checks.service.ts:94`) | **não, e é o pior** |

`proof-photos/` é o caso grave. A foto de prova é servida por URL assinada de
propósito, e o produto tem uma escolha explícita do usuário — `showProofPhoto` —
que decide se ela aparece no feed. **Um bucket público torna toda foto de prova
legível por qualquer pessoa com o link, independente dessa escolha.** Não é
detalhe de segurança: é desfazer uma decisão que o produto oferece ao usuário.

O plano era uma bucket policy liberando `s3:GetObject` só nos três prefixos de
cima. **No Tigris isso não existe:**

- `PutBucketPolicy` responde `NotImplemented`.
- O `ACL: 'public-read'` por objeto que o `uploadPublic` sempre mandou **é
  ignorado** quando o bucket é privado — testado em 03/08 com um objeto real,
  que continuou dando 403 para quem não estava autenticado.
- Lá o acesso público é **do bucket inteiro, ou nada** (`--acl public-read` na
  criação). O caminho inverso existe — dentro de um bucket público dá para
  marcar um objeto como privado — mas não serve aqui.

Confirmado na documentação do Tigris e no fórum da Fly, onde a resposta oficial
para "um bucket privado com um prefixo público" é exatamente a que está
implementada abaixo: **dois buckets.**

## 3. Os valores reais do deploy

Descobertos em 03/08 com as credenciais do dono. **Os dois divergem do padrão
escrito no código**, então não confie no default de `storage.service.ts`:

| | Padrão no código | **Real** |
|---|---|---|
| endpoint | `https://t3.storage.dev` | **`https://t3.storage.dev`** ✅ |
| bucket | `quibly-uploads` | **`nomads-uploads`** |

Ou seja: `S3_ENDPOINT` e `S3_BUCKET` **estão** definidos no ambiente do deploy.
Vivem só lá — nada no repositório os define, nem `railway.toml`, nem
`.env.example`.

> Se um dia precisar redescobrir isso sem credencial: a própria URL da foto
> responde. Ela é montada como `${S3_ENDPOINT}/${bucket}/${filePath}`. Pegue um
> `photo_url` de qualquer post no `GET /rooms/:id/feed` e o endpoint e o bucket
> estão escritos ali, no começo.

## 4. O que o código já faz

`storage.service.ts` passou a ler **dois** buckets, e `S3_BUCKET` continua sendo
lido como reserva — um deploy que ainda não recebeu as variáveis novas segue
funcionando exatamente como antes. Nada quebra por ordem de deploy.

| Variável | Papel | Se não vier |
|---|---|---|
| `S3_BUCKET_PUBLIC` | avatar, foto de post, clipe de áudio | cai em `S3_BUCKET` |
| `S3_BUCKET_PRIVATE` | prova, documento, aula | cai em `S3_BUCKET` |
| `S3_BUCKET` | reserva das duas | `quibly-uploads` |

`deleteObject` recebe só a chave e escolhe o bucket pelo prefixo
(`bucketDaChave`), porque o chamador não sabe — nem precisa saber — que existem
dois. Se essa escolha errar, o objeto fica órfão em silêncio; por isso ela tem
teste (`storage.service.spec.ts`).

**Na prática você só precisa criar e setar UMA variável.** `S3_BUCKET_PRIVATE`
pode ficar de fora: a reserva já aponta para `nomads-uploads`, que é onde o
material privado está hoje e onde deve continuar.

## 5. O que rodar

As credenciais são as mesmas que a API usa (`S3_ACCESS_KEY_ID` e
`S3_SECRET_ACCESS_KEY`, nas variáveis do serviço no Railway). **Elas não estão
nesta máquina, de propósito.**

```sh
export AWS_ACCESS_KEY_ID=...          # = S3_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=...      # = S3_SECRET_ACCESS_KEY
export AWS_REGION=auto

# 1. Criar o bucket público. O --acl na CRIAÇÃO é o que importa.
aws s3api create-bucket \
  --endpoint-url https://t3.storage.dev \
  --bucket nomads-public \
  --acl public-read
```

**2. No Railway, no serviço da API:** `S3_BUCKET_PUBLIC=nomads-public`. Redeploy.

A ordem importa: crie o bucket **antes** de setar a variável. Com a variável
apontando para um bucket que não existe, todo upload de avatar e de foto passa a
falhar.

> ⚠️ A chave usada no levantamento de 03/08 só conseguia `ListBuckets` —
> `GetBucketPolicy`, `ListObjectsV2` e `PutBucketPolicy` deram todos
> `AccessDenied`. Se o `create-bucket` acima responder `AccessDenied`, é isso: a
> chave é de leitura. Use o painel do Tigris ou uma chave de admin.

### Conferir que funcionou

```sh
# Publique uma foto pelo app e pegue o photo_url do feed. Deve dar 200.
curl -o /dev/null -w "%{http_code}\n" \
  https://t3.storage.dev/nomads-public/room-posts/<roomId>/<userId>/<postId>

# O controle, que TEM que continuar 403:
curl -o /dev/null -w "%{http_code}\n" \
  https://t3.storage.dev/nomads-uploads/proof-photos/qualquer-coisa
```

O segundo comando não é opcional. Se ele responder 200 ou `404 NoSuchKey`, o
bucket errado ficou público e a privacidade da prova foi embora junto — objeto
inexistente sob prefixo **público** responde `404`, sob prefixo **privado**
responde `403`. É o teste que discrimina sem precisar de credencial.

## 6. O que acontece com o que já está lá

**Nada, e isso não custa nada.** Os avatares e fotos que já subiram continuam em
`nomads-uploads`, com as URLs guardadas no banco apontando para lá, e continuam
dando 403 — que é **exatamente o que fazem hoje**. Nenhuma dessas imagens jamais
apareceu na tela: o avatar sempre caiu nas iniciais, a foto de post nunca
carregou. Não há regressão a evitar porque não há nada funcionando para perder.

Se um dia quiser recuperá-las, são dois passos e não um: copiar os objetos dos
três prefixos para o bucket novo **e** reescrever o segmento do bucket nas URLs
guardadas em `profile.avatarUrl` e `feedPost.photoUrl`. Copiar sem reescrever não
adianta — a URL no banco carrega o nome do bucket dentro dela.

## 7. A alternativa, se você preferir não abrir bucket nenhum

`StorageService.getSignedUrl` já existe (validade padrão de 7 dias, o teto do
SigV4). Dá para o `feed.service` assinar `photo_url` e `avatar_url` antes de
devolver, e aí **nenhum bucket precisa ser público**. Custa uma mudança de
backend e um deploy, e tem o efeito colateral de URLs que expiram — ruim para
cache de imagem no app, e a URL guardada no banco passa a ser inútil por conta
própria.

Recomendação: bucket público agora, porque destrava a Etapa 2 hoje; URL assinada
depois, se a privacidade de avatar e de foto de post virar requisito.
