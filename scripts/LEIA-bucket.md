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
- Lá o acesso público é **do bucket inteiro, ou nada**. O caminho inverso existe
  — dentro de um bucket público dá para marcar um objeto como privado — mas não
  serve aqui.

> **Correção de 06/08, vista no painel.** Este arquivo dizia que o acesso público
> só se define **na criação**, via `--acl public-read`. Não é verdade: em
> *Bucket Settings › Access and Sharing* há um seletor **Public / Private
> Access** que muda um bucket existente, com um botão `Update`. Ou seja, não é
> preciso criar bucket novo nem migrar objeto nenhum — dá para promover o
> `quibly-uploads`, que já existe e hoje só contém `room-posts/`.
>
> Na mesma tela há **Disable Directory Listing**, ligado por padrão: os objetos
> ficam legíveis por URL direta, mas ninguém lista o conteúdo do bucket. É o que
> se quer aqui, e não estava documentado.

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

## 4.1. O que trava hoje: cobrança, não permissão

> **Tentado em 06/08, pelo painel, com a conta do dono logada.** As duas rotas
> batem na mesma parede, e ela não é técnica:
>
> - **Criar bucket público** (`nomads-public`, toggle *Public* ligado): o botão
>   `Create` fica inerte, e o diálogo traz a razão por escrito — *"A verified
>   payment method is required to create public buckets."*
> - **Promover o `quibly-uploads`**: o seletor aceita `Public` e o `Update`
>   responde sem erro, mas ao recarregar a tela ele voltou para `Private`, e a
>   sonda continuou em `403 AccessDenied`. Mesma trava, desta vez **silenciosa**
>   — o que é pior, porque parece ter funcionado.
>
> Conclusão: **o Tigris exige método de pagamento verificado para qualquer bucket
> público.** Enquanto isso não for resolvido na conta, nenhuma variável de
> ambiente adianta, e a foto do feed continua em 403 por desenho do provedor.
>
> Sonda para reconferir sem abrir o painel:
>
> ```sh
> curl -s "https://t3.storage.dev/quibly-uploads/sonda-$(date +%s)" | grep -o "<Code>[^<]*</Code>"
> # AccessDenied → ainda privado.  NoSuchKey → público, pode seguir para a §5.
> ```

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

⚠️ **Leia o `<Code>` do corpo, não só o status.** A versão anterior desta seção
comparava apenas `%{http_code}`, e isso não discrimina o caso que mais importa:
um bucket **que não existe** responde `404` igualzinho a um bucket público sem
aquele objeto. Quem seguisse o roteiro antigo veria `404`, leria "público,
funcionou" e teria criado nada. Foi o que a sonda de 04/08 encontrou — e só
porque olhou o corpo.

```sh
# Existe e está público? Objeto inexistente deve dar 404 **NoSuchKey**.
# Se vier 404 NoSuchBucket, o bucket não foi criado — volte para a §5.
# Se vier 403 AccessDenied, ele existe mas continua privado: o --acl não pegou.
for b in nomads-public nomads-uploads; do
  printf "%-16s " "$b"
  curl -s -o /tmp/r -w "%{http_code}" "https://t3.storage.dev/$b/sonda-$(date +%s)"
  grep -o "<Code>[^<]*</Code>" /tmp/r; echo
done
```

Esperado depois de tudo pronto:

| bucket | status | `<Code>` |
|---|---|---|
| `nomads-public` | `404` | `NoSuchKey` |
| `nomads-uploads` | `403` | `AccessDenied` |

A linha do `nomads-uploads` não é opcional. Se ela virar `404`, o bucket errado
ficou público e a privacidade da prova foi embora junto. É o teste que
discrimina sem precisar de credencial nenhuma.

**Estado em 04/08/2026:** `nomads-public` → `404 NoSuchBucket`,
`nomads-uploads` → `403 AccessDenied`. Ou seja: o bucket público **ainda não
existe** e o privado está intacto. A §5 continua por fazer, e é o único elo que
falta na Etapa 2 — os dois lados do código já estão prontos e testados.

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
