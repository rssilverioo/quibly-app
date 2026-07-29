# Risco do banco compartilhado

> Diagnóstico apenas. Nenhum comando de escrita foi rodado contra produção
> para produzir este documento — as conclusões abaixo vêm de leitura de
> código (`schema.prisma`, migrations, `railway.toml`) e do texto do próprio
> repo. Nada aqui foi executado. Ver "Passos de verificação" no final: há
> perguntas que só o CEO (ou quem tem acesso ao Postgres de produção) pode
> responder, porque não temos visibilidade sobre o produto vizinho.

## O fato que dispara isso

`apps/api/prisma/schema.prisma`, no model `Lesson`:

```prisma
  // Not "lessons": that name belongs to another product's table in the shared
  // production database, and it has dependents.
  @@map("captured_lessons")
```

Ou seja: em algum momento, alguém tentou (ou considerou) chamar essa tabela de
`lessons`, descobriu que já existia uma tabela com esse nome no mesmo Postgres
de produção, pertencente a **outro produto**, com dependentes (FKs, views, ou
código que a lê) — e renomeou a nossa para não colidir. Isso confirma três
coisas ao mesmo tempo:

1. Compartilhamos o **mesmo banco Postgres de produção** com outro produto.
2. Estamos no **mesmo schema Postgres** (`public`) — se estivéssemos em
   schemas separados, `lessons` e `captured_lessons` poderiam coexistir sem
   ninguém precisar renomear nada.
3. Já colidimos pelo menos uma vez, e a solução usada foi "renomear a nossa
   tabela", não "separar os bancos". É uma correção pontual, não estrutural.

## Confirmação: `prisma migrate deploy` já roda em produção hoje, sempre

`railway.toml`:

```toml
[deploy]
startCommand = "cd apps/api && npx prisma migrate deploy && node dist/main.js"
```

Isso não é um comando que "poderíamos rodar por engano" — é o **primeiro
passo de todo deploy**, em todo merge que dispara deploy no Railway. Migration
contra o banco compartilhado não é um risco hipotético: é algo que já
acontece, automaticamente, sem revisão humana no momento da execução, toda
vez que fazemos deploy.

## Evidência de que já tivemos atrito

A migration `20260417000000_onboarding_daily_plan` usa `IF NOT EXISTS` em
**todo** statement — `CREATE TABLE`, `CREATE UNIQUE INDEX`, `CREATE INDEX`,
`ADD COLUMN`:

```sql
CREATE TABLE IF NOT EXISTS "daily_plans" ( ... );
CREATE UNIQUE INDEX IF NOT EXISTS "daily_plans_user_id_date_key" ...;
```

É a única migration do histórico com esse padrão defensivo — as outras 10 usam
`CREATE TABLE` puro. Não temos como confirmar a causa exata sem acesso ao
histórico de deploy (ver "Passos de verificação"), mas as duas explicações
plováveis são igualmente preocupantes:

- Uma tentativa anterior de deploy falhou no meio (rede, timeout, deploy
  cancelado) e essa versão idempotente foi a correção — o que já mostra que
  `migrate deploy` falhando pela metade é algo que aconteceu na prática, não
  só na teoria.
- `daily_plans` já existia no banco por outro motivo (uma tabela do produto
  vizinho, ou um resquício de uma tentativa anterior) e alguém precisou
  tornar a migration tolerante a isso.

Qualquer uma das duas é exatamente o tipo de fragilidade que este documento
existe para nomear.

## Quais tabelas são claramente nossas

Todas as tabelas do nosso `schema.prisma` seguem uma convenção coesa: nomes
em `snake_case`, quase todas com FK para `profiles.id` (nosso usuário,
identificado pelo Firebase UID), e todas nascidas nas mesmas 11 migrations
neste repo. Isso é forte evidência de posse, mas **não é uma garantia
técnica** — nada no Postgres marca essas tabelas como "do Quibly"; a única
coisa que impede o produto vizinho de ter uma tabela `subjects` ou
`documents` também é coincidência de naming.

| Tabela (nome no banco) | Model Prisma |
|---|---|
| `profiles` | Profile |
| `subjects` | Subject |
| `study_sessions` | StudySession |
| `proof_checks` | ProofCheck |
| `leagues` | League |
| `league_members` | LeagueMember |
| `feed_posts` | FeedPost |
| `feed_reactions` | FeedReaction |
| `feed_comments` | FeedComment |
| `chat_messages` | ChatMessage |
| `chat_reactions` | ChatReaction |
| `achievements` | Achievement |
| `user_achievements` | UserAchievement |
| `push_tokens` | PushToken |
| `documents` | Document |
| `captured_lessons` | Lesson (**renomeada de propósito** — ver acima) |
| `flashcard_sets`, `flashcards` | FlashcardSet, Flashcard |
| `quizzes`, `questions` | Quiz, Question |
| `daily_usage` | DailyUsage |
| `audio_clips` | AudioClip |
| `audio_study_sessions` | AudioStudySession |
| `daily_plans` | DailyPlan (**migration defensiva** — ver acima) |

Mais os 11 enums Postgres (`plan`, `timer_mode`, `session_status`,
`lesson_source`, `lesson_status`, `proof_check_status`, `league_privacy`,
`league_mode`, `league_status`, `member_role`, `chat_message_type`) e a
tabela de controle `_prisma_migrations`, que o Prisma Migrate cria e mantém
sozinho.

## Quais nomes são ambíguos / risco de colisão

Não temos visibilidade do schema do produto vizinho — isso por si só é o
maior gap deste diagnóstico (ver "Passos de verificação"). O que dá para
dizer com o que temos:

- **`lessons` é uma colisão confirmada.** Não uma suposição — está no
  comentário do código. O produto vizinho tem uma tabela `lessons` com
  dependentes. Se algum dia recriarmos a nossa como `lessons` (um rename
  "cosmético" durante um refactor, por exemplo), quebramos os dois lados.
- **`profiles` é o nome de maior risco genérico.** É a tabela-padrão que todo
  projeto iniciado no Supabase cria por convenção (ligada a `auth.users`).
  Este repo tem `supabase/schema.sql` — nosso **próprio** legado Supabase,
  hoje morto, mas que confirma que o Quibly nasceu nesse padrão. Se o produto
  vizinho também nasceu como projeto Supabase (comum nesse ecossistema), a
  chance de ele também ter (ou ter tido) uma tabela `profiles` é real. Não
  colidimos ainda, mas é o nome mais fácil de colidir no futuro.
- **`documents`, `sessions`/`study_sessions`, `questions`, `achievements`,
  `subscriptions`-like fields em `profiles`** são nomes comuns o bastante em
  produtos de estudo/conteúdo para não descartar coincidência — não temos
  como confirmar sem o inventário real do schema (`pg_tables`) do produto
  vizinho.
- **`_prisma_migrations`, a tabela de controle do Prisma Migrate, é o risco
  mais sério e menos falado.** Se o produto vizinho **também** usa Prisma
  Migrate contra este mesmo Postgres/schema `public`, os dois projetos
  disputam (ou compartilham sem saber) a mesma tabela de bookkeeping de
  migrations. Isso é pior que uma colisão de nome de tabela de domínio: pode
  fazer o `migrate deploy` de um lado achar que uma migration já foi aplicada
  quando não foi (ou vice-versa), corrompendo o histórico dos dois lados.
  **Não sabemos se é o caso.** É a pergunta nº 1 da lista de verificação.

## O risco concreto: o que acontece hoje se rodarmos `prisma migrate deploy` em produção

Isso já roda hoje, em todo deploy (ver acima). O que pode dar errado num
deploy futuro, sem mudar nada do nosso processo:

1. **Colisão de `CREATE TABLE`/`CREATE TYPE` derruba o nosso próprio
   deploy.** Se uma migration nossa tentar criar algo que já existe (nome de
   tabela, de enum, de índice) e não for `IF NOT EXISTS`, `prisma migrate
   deploy` falha com erro do Postgres. Como esse comando roda **antes** de
   `node dist/main.js` no `startCommand`, a falha impede o container de
   subir — a API inteira fica fora do ar até alguém investigar e reverter a
   migration. Ou seja: a colisão nem precisa envolver dados do vizinho para
   nos derrubar — só precisa de um nome igual.
2. **Colisão silenciosa em vez de erro.** Um padrão como o `IF NOT EXISTS`
   que já usamos uma vez esconde a falha: se a tabela/coluna/índice que "já
   existia" pertence na verdade ao produto vizinho e tem uma estrutura
   diferente da que o Prisma Client espera, a migration "passa" sem erro,
   mas a aplicação começa a gerar 500 em runtime (coluna que não existe,
   tipo incompatível) — ou pior, grava dados na tabela errada.
3. **Não existe barreira técnica que impeça uma migration nossa de tocar
   objetos do vizinho.** `prisma migrate deploy` executa SQL bruto, na ordem
   dos arquivos em `apps/api/prisma/migrations/`, sem sandbox e sem
   whitelist de quais tabelas "são nossas". Nada no Postgres hoje impede um
   `ALTER TABLE`, `DROP TABLE` ou `RENAME` — escrito por engano, por um nome
   ambíguo, ou por uma ferramenta como `prisma migrate reset` /
   `prisma db push --accept-data-loss` (não usadas por nós, mas
   tecnicamente executáveis com a mesma `DATABASE_URL`) — de afetar uma
   tabela do vizinho. **A separação de nomes hoje é convenção, não
   permissão.**
4. **Blast radius da credencial.** Para nossas migrations funcionarem, a
   role Postgres por trás de `DATABASE_URL` precisa ter privilégio de DDL
   (`CREATE`/`ALTER`/`DROP`) no schema `public`. Não há indicação de que
   esse privilégio esteja restrito às nossas tabelas — o que significa que,
   independente de migration, qualquer bug de SQL cru, credencial vazada, ou
   erro humano rodando um comando manual contra essa `DATABASE_URL` pode, em
   tese, ler ou escrever nas tabelas do vizinho. E o inverso também é
   verdade: se a credencial deles tem o mesmo nível de acesso, uma migration
   *deles* pode nos derrubar. O comentário no schema já reconhece isso
   ("e vice-versa" está em `docs/ARCHITECTURE.md` §5).

Resumindo em uma frase: hoje, toda vez que fazemos merge de uma migration, a
única coisa que evita um incidente cross-produto é a disciplina de quem
escreveu o SQL — não existe barreira de schema, de permissão ou de processo.

## Duas opções de separação

### Opção A — Schema Postgres dedicado, mesmo cluster/instância

Criar um schema Postgres próprio (ex.: `quibly`) na mesma instância Railway,
mover as ~24 tabelas + 11 enums do Quibly de `public` para `quibly`, e apontar
`DATABASE_URL` para esse schema (`postgresql://...?schema=quibly` — suportado
nativamente pelo Prisma, sem precisar da preview feature `multiSchema` nem
mudar `schema.prisma`). Mover uma tabela de schema em Postgres
(`ALTER TABLE public.x SET SCHEMA quibly`) é uma operação de metadado, não
reescreve dados — é rápida mesmo em produção.

**Prós**
- Resolve o risco de colisão de nomes de forma definitiva e imediata:
  `quibly.profiles` e `public.profiles` (do vizinho) podem coexistir sem
  conflito algum.
- Com `GRANT`/`REVOKE` correto nas duas roles (a nossa só com acesso a
  `quibly`, a deles só com acesso a `public`), também fecha o risco de blast
  radius da credencial — cada lado só enxerga o próprio schema.
- Não precisa provisionar infraestrutura nova nem negociar orçamento
  adicional — mesmo Postgres, mesmo plano Railway.
- Reversível e replicável: o mesmo script serve de ensaio em um ambiente de
  staging/cópia antes de tocar produção.

**Contras**
- Continua sendo **o mesmo processo Postgres físico**: CPU, IO, conexões,
  disco e janela de manutenção continuam compartilhados. Uma query pesada ou
  um esgotamento de connection pool do vizinho ainda pode degradar a nossa
  API, e vice-versa.
- Um erro num `pg_dump`/`pg_restore`/upgrade de versão major do Postgres
  ainda afeta os dois produtos ao mesmo tempo — não há isolamento de blast
  radius de infraestrutura, só de namespace de dados.
- Só funciona de verdade se o `GRANT`/`REVOKE` for aplicado com disciplina;
  sem isso, resolve só a colisão de nomes, não o acesso cruzado.
- Exige coordenação com quem opera o produto vizinho: mesmo que só *nossas*
  tabelas se movam, a operação toca a mesma instância que eles usam, e eles
  precisam ser avisados (ou, no mínimo, não deveriam ser pegos de surpresa
  por um `ALTER TABLE ... SET SCHEMA` acontecendo do lado deles).

**Esforço estimado:** baixo — meio dia a um dia, incluindo o script de
migração de schema, teste em cópia/staging, `GRANT`/`REVOKE`, atualização de
`DATABASE_URL` no Railway e uma janela curta (minutos, não horas) para o
corte em produção.

### Opção B — Instância Postgres própria (managed, dedicada)

Provisionar um novo Postgres (novo plugin Railway, ou RDS/Neon/outro
managed) só para o Quibly, migrar os dados (`pg_dump`/`pg_restore` ou
replicação lógica), trocar `DATABASE_URL` para a nova instância, e
reconstruir o histórico de `_prisma_migrations` lá (ou aplicar as migrations
do zero num banco vazio, o que é preferível a transplantar a tabela de
controle).

**Prós**
- Isolamento real: compute, storage, conexões, failover, janela de
  manutenção e versão do Postgres passam a ser inteiramente nossos. Nenhum
  evento do lado do vizinho (pico de tráfego, erro de operação, upgrade)
  pode nos afetar, e nada que fizermos pode afetá-los.
- Fecha ao mesmo tempo o risco de colisão de nomes **e** o risco de blast
  radius de credencial — não tem "se o GRANT for esquecido", a separação é
  física.
- Habilita, mais para frente, tuning específico para o nosso padrão de
  carga (uso pesado de IA/gravação vs. o padrão de tráfego do vizinho) sem
  negociar com outro time.
- História mais simples para qualquer pedido futuro de auditoria/compliance
  ("nosso banco de produção" vira uma resposta de uma frase).

**Contras**
- Esforço real de migração: dump/restore (ou replicação) de todas as
  tabelas, com uma janela de corte — provavelmente curto downtime (15–60 min)
  para o cutover, dado o volume de dados hoje ser pequeno (produto
  pré-lançamento), mas isso precisa ser confirmado, não assumido.
- Novo item de custo recorrente (segunda instância Postgres).
- Mais partes móveis para dar errado no meio do caminho (reconciliar
  `_prisma_migrations`, validar índices, revalidar toda a stack de
  integrações que dependem da `DATABASE_URL`) — precisa de plano de
  rollback testado antes do corte real.
- Não é reversível "de graça": voltar atrás depois do corte significa migrar
  de novo, na direção oposta.

**Esforço estimado:** médio — um a três dias de engenharia (script de
migração, ensaio em staging, checklist de verificação pós-corte) mais a
janela de corte em si, e um novo custo recorrente de infraestrutura.

## Recomendação

**Opção A agora, na Fase 0. Opção B como gatilho de escala, não como
bloqueador de lançamento.**

O risco agudo hoje não é performance nem compliance — é que uma migration
nossa (que já roda automaticamente em todo deploy) colida por nome com algo
do vizinho e derrube um dos dois produtos, ou pior, corrompa dados
silenciosamente. Isso é 100% resolvido por schema dedicado, é uma operação de
metadado (rápida, de baixo risco técnico), não exige orçamento novo, e pode
ser feito nesta fase sem atrasar o lançamento. Instância própria é a
separação "de verdade" — vale a pena, mas o gatilho certo para fazer essa
segunda etapa é tração real (tráfego, receita, ou o produto vizinho fazendo
algo arriscado do lado dele — um reset, um upgrade major, uma migration sem
`IF NOT EXISTS`), não a data de hoje.

Este é um plano em duas etapas deliberado: não deixar o ótimo (instância
própria) ser inimigo do bom (schema dedicado) quando o bom já resolve o
risco agudo por uma fração do esforço.

## Passos de verificação que o CEO precisa fazer antes de qualquer execução

Nada abaixo foi feito — são perguntas que este documento **não consegue**
responder de dentro do repo, e que bloqueiam qualquer execução, mesmo da
Opção A:

1. **Quem é o "outro produto"?** Nome, time responsável, se ainda está ativo
   em produção, e se alguém ainda faz deploy contra essa mesma
   `DATABASE_URL` hoje.
2. **Inventário real do schema `public`.** Rodar (ou pedir para alguém com
   acesso rodar) `SELECT schemaname, tablename FROM pg_tables WHERE
   schemaname = 'public';` no Postgres de produção. Hoje só temos visibilidade
   das ~24 tabelas do nosso `schema.prisma` — estamos cegos para tudo que não
   é nosso.
3. **O vizinho também usa Prisma Migrate?** Verificar se existe uma tabela
   `_prisma_migrations` com entradas que não batem com
   `apps/api/prisma/migrations/`. Se sim, o risco da tabela de controle
   (seção acima) é real e muda a urgência da separação.
4. **Qual o privilégio real da nossa role Postgres?** Ela tem DDL só nas
   nossas tabelas, ou é dona do schema `public` inteiro (o que hoje parece
   ser o caso, já que nossas migrations criam tabelas livremente)?
5. **Existe backup/PITR testado e recente?** Antes de qualquer
   `ALTER TABLE ... SET SCHEMA` (Opção A) ou dump/restore (Opção B), precisa
   haver um backup confirmado e um plano de rollback escrito — para os dois
   produtos, não só o nosso.
6. **Coordenação com quem opera o produto vizinho.** Aviso prévio e janela
   combinada, mesmo que a operação (Opção A) só mexa nas nossas tabelas —
   eles usam a mesma instância e precisam saber que algo vai acontecer.
7. **Aprovação explícita e por escrito** de qual opção (A ou B) executar, e
   quando. Este documento é diagnóstico — a separação em si não está
   autorizada por ele.
