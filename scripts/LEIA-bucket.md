# Liberar a foto do feed — o host da URL

> **Reescrito em 2026-08-06 (segunda vez no dia).** As duas versões anteriores
> deste arquivo mandavam **criar um bucket público**, e a última concluiu que o
> que travava era **cobrança**. As duas conclusões estavam erradas, e pela mesma
> razão: a sonda que usávamos não distingue "bucket privado" de "host errado".
> O bucket público **já existe**. O histórico e o porquê do engano estão na §2.

## 1. O problema que isto resolve

A foto do post sobe para o storage, o post entra no feed, e a URL da imagem
responde **403**. O detalhe do post é a prova mais limpa: ele reserva o bloco da
foto na proporção certa e o mantém em esqueleto para sempre. O espaço está lá, o
endereço está lá, o arquivo não vem.

**A causa é o host da URL, não a permissão do bucket.** No Tigris o bucket
público é servido por um domínio próprio; o endpoint da API responde `403`
**mesmo para objeto público**. A URL que o código montava — e que foi parar no
banco — apontava para o endpoint.

## 2. A medição que decide, e por que ela demorou

O bucket `quibly` é o mesmo nos dois comandos abaixo. Só o host muda:

```sh
curl -s https://quibly.t3.storage.dev/sonda-x   # 404 NoSuchKey    ← público
curl -s https://t3.storage.dev/quibly/sonda-x   # 403 AccessDenied ← o mesmo bucket
```

Mesmo bucket, mesma chave inexistente, respostas opostas. O acesso anônimo no
Tigris funciona **por virtual-host** (`<bucket>.t3.storage.dev`), e o endereço
path-style (`t3.storage.dev/<bucket>/`) recusa leitura anônima **sempre**,
independente do bucket ser público.

E `cdn.tryquibly.com` é esse mesmo bucket, por CNAME:

```sh
dig +short cdn.tryquibly.com   # → quibly.t3.storage.dev.
```

> **Por que duas investigações inteiras pararam no lugar errado.** Toda sonda
> anterior era path-style, e o `403 AccessDenied` dela é indistinguível do 403 de
> um bucket genuinamente privado. Cada rodada lia esse 403 como "ainda privado",
> ia procurar por que a permissão não pegava, e achava uma explicação plausível:
> primeiro o `PutBucketPolicy` `NotImplemented`, depois a cobrança. **As duas
> explicações eram verdadeiras e nenhuma era a causa.** Um sintoma que duas
> hipóteses diferentes explicam igualmente bem é sinal de que a sonda não está
> medindo o que se pensa — foi o que aconteceu aqui, duas vezes.

### O que a sonda certa diz hoje

Rodado em 06/08/2026, desta máquina, **sem credencial nenhuma**:

| bucket | virtual-host (vale) | path-style (não vale) | leitura |
|---|---|---|---|
| `quibly` | `404 NoSuchKey` | `403 AccessDenied` | **público** |
| `quibly-uploads` | `403 AccessDenied` | `403 AccessDenied` | privado |
| `nomads-uploads` | `403 AccessDenied` | `403 AccessDenied` | privado |
| `nomads-public` | — | `404 NoSuchBucket` | **não existe** |

Duas leituras importantes aqui. **O bucket público já existe e se chama
`quibly`** — não é preciso criar nada, e o `nomads-public` das versões
anteriores nunca foi criado. E **`nomads-uploads` é genuinamente privado**, o que
mantém intacta a privacidade da foto de prova (§3).

```sh
# A sonda, para reconferir sem abrir o painel. Repare no host.
for b in quibly nomads-uploads; do
  printf "%-16s " "$b"
  curl -s -o /tmp/r -w "%{http_code} " "https://$b.t3.storage.dev/sonda-$(date +%s)"
  grep -o "<Code>[^<]*</Code>" /tmp/r; echo
done
# NoSuchKey → público.  AccessDenied → privado.  NoSuchBucket → não existe.
```

A linha do `nomads-uploads` não é opcional: se ela virar `NoSuchKey`, o bucket
errado ficou público e a privacidade da prova foi embora junto.

## 3. Por que dois buckets, e não um com política por prefixo

Isto continua valendo, e é a parte do documento que nunca esteve errada.

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

Liberar só os três prefixos de cima não é possível no Tigris:

- `PutBucketPolicy` responde `NotImplemented`.
- O `ACL: 'public-read'` por objeto que o `uploadPublic` sempre mandou **é
  ignorado**. Lá o acesso é do bucket inteiro, ou nada.

Daí a separação física em dois buckets, que é o que o código implementa.

## 4. O que o código já faz

`storage.service.ts` lê **quatro** variáveis, e nenhuma delas é obrigatória — um
deploy que não recebeu as novas se comporta exatamente como antes.

| Variável | Papel | Se não vier |
|---|---|---|
| `S3_PUBLIC_BASE_URL` | **de onde o app baixa** — o domínio, não o endpoint | `S3_ENDPOINT/S3_BUCKET_PUBLIC` (o comportamento errado de hoje) |
| `S3_BUCKET_PUBLIC` | **onde o arquivo é gravado** — avatar, foto, clipe | cai em `S3_BUCKET` |
| `S3_BUCKET_PRIVATE` | prova, documento, aula | cai em `S3_BUCKET` |
| `S3_BUCKET` | reserva das duas | `quibly-uploads` |

> ⚠️ **As duas primeiras têm que concordar, e nada verifica isso.**
> `S3_BUCKET_PUBLIC` diz onde o objeto é escrito; `S3_PUBLIC_BASE_URL` diz onde o
> app vai procurá-lo. Se apontarem para buckets diferentes, o upload passa, a
> linha grava, e a foto dá **404** — um sintoma novo, e igualmente silencioso. O
> código não tem como conferir: um domínio não revela que bucket ele serve.

Dois detalhes que já estão cobertos por teste (`storage.service.spec.ts`, 24
casos):

- **`chaveDaUrl` reconhece as duas formas de URL**, e isso não é transitório. O
  banco guarda a URL inteira, então tudo que subiu antes do domínio existir está
  gravado como `t3.storage.dev/<bucket>/<chave>`. Se só a forma nova fosse
  reconhecida, apagar um avatar antigo devolveria `null`, o registro sumiria do
  banco e o objeto ficaria órfão no storage, em silêncio.
- **`S3_PUBLIC_BASE_URL` sem esquema recusa o boot.** `cdn.tryquibly.com` em vez
  de `https://cdn.tryquibly.com` é o erro de digitação natural num painel, e ele
  não levanta exceção em lugar nenhum: o upload passa e o `<Image>` fica vazio.
  Como essa URL é *gravada* no banco, o estrago seria permanente, uma linha por
  foto. Um deploy vermelho no Railway é a única janela em que o erro é barato.

`deleteObject` recebe só a chave e escolhe o bucket pelo prefixo
(`bucketDaChave`), porque o chamador não sabe — nem precisa saber — que existem
dois.

## 5. O que fazer

Não há bucket para criar e não há objeto para migrar. É configuração no Railway,
no serviço da API:

```
S3_PUBLIC_BASE_URL=https://cdn.tryquibly.com
S3_BUCKET_PUBLIC=quibly
```

Redeploy. As credenciais (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) já estão
lá e não mudam — **e não estão nesta máquina, de propósito.**

> **O único ponto em aberto: quanto vale `S3_BUCKET_PUBLIC` hoje.** O
> levantamento de 03/08 encontrou `S3_BUCKET=nomads-uploads`, mas
> `S3_BUCKET_PUBLIC` pode ter sido setada depois — e um objeto real respondeu
> `200` por `cdn.tryquibly.com` em 06/08, o que só acontece se ele estiver em
> `quibly`. Isso se resolve olhando a variável no painel do Railway. Se ela já
> for `quibly`, **falta só a `S3_PUBLIC_BASE_URL`** e as fotos existentes voltam
> a aparecer sozinhas. Se for `nomads-uploads`, as duas linhas acima são
> necessárias, e vale ler a §6 antes.

### Conferir que funcionou

```sh
# 1. O bucket público continua público, e o privado continua privado.
for b in quibly nomads-uploads; do
  printf "%-16s " "$b"
  curl -s -o /tmp/r -w "%{http_code} " "https://$b.t3.storage.dev/sonda-$(date +%s)"
  grep -o "<Code>[^<]*</Code>" /tmp/r; echo
done
```

| bucket | esperado |
|---|---|
| `quibly` | `404 NoSuchKey` |
| `nomads-uploads` | `403 AccessDenied` |

2. Poste uma foto pelo app e confira que o `photo_url` do
   `GET /rooms/:id/feed` começa com `https://cdn.tryquibly.com/` — e não com
   `t3.storage.dev`. Se ainda vier o endpoint, a variável não chegou ao processo.
3. Abra essa URL no navegador. `200` fecha a Etapa 2.

## 6. O que acontece com o que já está lá

Depende da resposta da pergunta em aberto da §5.

**Se `S3_BUCKET_PUBLIC` já era `quibly`:** nada a fazer. Os objetos estão no
bucket certo e sempre estiveram; só a URL guardada no banco nomeia o host errado.
Note que isso **não** conserta as fotos antigas sozinho — a URL gravada continua
apontando para `t3.storage.dev`. Fotos novas aparecem; as antigas precisam de uma
reescrita de `profile.avatarUrl` e `feedPost.photoUrl`, trocando o prefixo
`https://t3.storage.dev/<bucket>/` por `https://cdn.tryquibly.com/`. É um
`UPDATE` com `replace()`, sem copiar objeto nenhum.

**Se era `nomads-uploads`:** os objetos públicos estão num bucket privado, e são
dois passos, não um — copiar os três prefixos públicos para `quibly` **e**
reescrever as URLs no banco. Copiar sem reescrever não adianta, porque a URL
guardada carrega o nome do bucket dentro dela.

Em nenhum dos casos há regressão a evitar: essas imagens nunca apareceram na tela.
O avatar sempre caiu nas iniciais, a foto de post nunca carregou.

## 7. A alternativa, se um dia a privacidade mudar de ideia

`StorageService.getSignedUrl` já existe (validade padrão de 7 dias, o teto do
SigV4). Dá para o `feed.service` assinar `photo_url` e `avatar_url` antes de
devolver, e aí **nenhum bucket precisa ser público**. Custa uma mudança de
backend e um deploy, e tem o efeito colateral de URLs que expiram — ruim para
cache de imagem no app, e a URL guardada no banco passa a ser inútil por conta
própria.

Recomendação: o domínio público agora, porque destrava a Etapa 2 com duas
variáveis; URL assinada depois, se a privacidade de avatar e de foto de post
virar requisito.
