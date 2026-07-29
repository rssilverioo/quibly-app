# [SQUAD IA/DADOS · FASE 1] Domínio de currículo — o eixo do produto

Você é o tech lead de dados/IA do Quibly (app de estudo, NestJS + Prisma +
Postgres). Sua tarefa é construir o **domínio de currículo**: a estrutura que
faz "Brasil primeiro, depois o mundo" ser um seed de dados em vez de um refactor.

**Leia primeiro:** `docs/ARCHITECTURE.md` §2 — leia inteiro, é a decisão central
da reformulação.

Branch: `f1/curriculum`. Depende do CI da Fase 0 estar verde.

---

## O modelo

```
Country (BR, US, …)
  └── ExamTrack        ENEM · Concursos · OAB · SAT · AP
        └── Discipline  Matemática · Redação · Biologia
              └── Topic  "Funções quadráticas"  (peso, frequência em prova)
```

O `Topic` é a unidade atômica do sistema inteiro. Ele conecta onboarding, salas,
sessões, quizzes, medição de domínio e — na Fase 6 — o gerador de plano.

## Tarefa

### 1. Schema

Adicione ao `apps/api/prisma/schema.prisma`:

- `Country`, `ExamTrack`, `Discipline`, `Topic`
- `Topic` precisa de **peso** (quanto vale na prova) e **frequência histórica** —
  são os dois números que a Fase 6 usa para priorizar
- `Profile` ganha `countryCode`, `examTrackId`, `timezone`
- `Question` ganha `topicId`
- `SessionTopic` (junção sessão × tópicos estudados)
- `TopicMastery`: usuário × tópico — tentativas, acertos, ease factor,
  `lastSeenAt`, `nextDueAt`. **Crie a tabela agora mesmo sem preencher ainda**;
  a Fase 4 começa a alimentar. Criar depois custa um backfill que não existe.

⚠️ O Postgres de produção é compartilhado com outro produto. Alinhe **toda**
migration com o squad Core antes de aplicar (`ARCHITECTURE.md §5`).

### 2. Seeds — Brasil e Estados Unidos

Os dois mercados do dia 1.

- **BR:** ENEM (completo, por área), Concursos (as carreiras mais buscadas), OAB
- **US:** SAT, e os APs mais cursados

Qualidade importa mais que volume: um ENEM bem modelado, com pesos reais
tirados das provas anteriores, vale mais que cinco tracks rasos. Documente a
fonte dos pesos — vamos ser cobrados por eles.

Os seeds precisam ser **idempotentes** e versionados: adicionar um país depois
não pode exigir código novo, só um arquivo de seed novo. Esse é o teste de que
a arquitetura funcionou.

### 3. Onboarding por geolocalização

- Resolver país por locale do dispositivo + IP (com o locale mandando em caso de conflito — quem mora fora estuda para a prova do país de origem)
- Sugerir o ExamTrack; **o usuário sempre pode trocar** — sugestão, nunca imposição
- Ao escolher o track, popular os `Subject` do usuário a partir das `Discipline`
- Perguntar a data da prova alvo se existir (a Fase 6 depende disso)

### 4. API

- `GET /curriculum/countries`
- `GET /curriculum/tracks?country=BR`
- `GET /curriculum/tracks/:id/disciplines`
- `GET /curriculum/topics?disciplineId=`
- `POST /users/me/track`

Cacheie: currículo muda uma vez por ano, não a cada request.

---

## Pronto quando

- [ ] Schema migrado, alinhado com o Core
- [ ] ENEM, Concursos, OAB, SAT e APs populados com pesos documentados
- [ ] Adicionar um país novo = um arquivo de seed, zero código
- [ ] Onboarding sugere track por geo e popula subjects
- [ ] `TopicMastery` existe, vazia, pronta para a Fase 4
- [ ] Testes: resolução de país, idempotência do seed, popular subjects

## Não faça

- Não gere o currículo inteiro com LLM sem revisão humana — peso errado de
  tópico envenena o plano de estudo de todo mundo depois
- Não implemente o gerador de plano (é Fase 6) — só as fundações de dados
- Não aplique migration sem alinhar com o Core
