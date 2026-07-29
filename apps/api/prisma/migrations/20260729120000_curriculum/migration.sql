-- Fase 1 / IA-Dados — domínio de currículo.
--
-- Country → ExamTrack → Discipline → Topic, mais as duas tabelas que fecham o
-- loop com o resto do produto (SessionTopic agora, TopicMastery vazia para a
-- Fase 4).
--
-- DDL idempotente e prefixo `quibly_` nas tabelas novas. O banco deixou de ser
-- compartilhado (ver docs/DB-SHARED-RISK.md), mas a convenção fica: misturar
-- dois padrões de nomenclatura é pior que manter um que não incomoda.

CREATE TABLE IF NOT EXISTS "quibly_countries" (
  "code"       CHAR(2) NOT NULL,
  "name_en"    TEXT NOT NULL,
  "name_pt"    TEXT NOT NULL,
  "locale"     TEXT NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "quibly_countries_pkey" PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS "quibly_exam_tracks" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "country_code" CHAR(2) NOT NULL,
  "slug"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "quibly_exam_tracks_pkey" PRIMARY KEY ("id")
);

-- O par (país, slug) é a chave de upsert dos seeds. Sem este unique os seeds
-- deixam de ser idempotentes e cada deploy duplicaria o currículo inteiro.
CREATE UNIQUE INDEX IF NOT EXISTS "quibly_exam_tracks_country_code_slug_key"
  ON "quibly_exam_tracks" ("country_code", "slug");
CREATE INDEX IF NOT EXISTS "quibly_exam_tracks_country_code_idx"
  ON "quibly_exam_tracks" ("country_code");

CREATE TABLE IF NOT EXISTS "quibly_disciplines" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "track_id"   UUID NOT NULL,
  "slug"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "color"      TEXT NOT NULL DEFAULT '#7C5CFC',
  "icon"       TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "quibly_disciplines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quibly_disciplines_track_id_slug_key"
  ON "quibly_disciplines" ("track_id", "slug");
CREATE INDEX IF NOT EXISTS "quibly_disciplines_track_id_idx"
  ON "quibly_disciplines" ("track_id");

CREATE TABLE IF NOT EXISTS "quibly_topics" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "discipline_id" UUID NOT NULL,
  "slug"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "weight"        INTEGER NOT NULL DEFAULT 50,
  "frequency"     INTEGER NOT NULL DEFAULT 5,
  "weight_source" TEXT,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "quibly_topics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quibly_topics_discipline_id_slug_key"
  ON "quibly_topics" ("discipline_id", "slug");
CREATE INDEX IF NOT EXISTS "quibly_topics_discipline_id_idx"
  ON "quibly_topics" ("discipline_id");

CREATE TABLE IF NOT EXISTS "quibly_session_topics" (
  "session_id" UUID NOT NULL,
  "topic_id"   UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "quibly_session_topics_pkey" PRIMARY KEY ("session_id", "topic_id")
);

CREATE INDEX IF NOT EXISTS "quibly_session_topics_topic_id_idx"
  ON "quibly_session_topics" ("topic_id");

CREATE TABLE IF NOT EXISTS "quibly_topic_mastery" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      TEXT NOT NULL,
  "topic_id"     UUID NOT NULL,
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "correct"      INTEGER NOT NULL DEFAULT 0,
  "ease_factor"  DECIMAL(4,2) NOT NULL DEFAULT 2.5,
  "last_seen_at" TIMESTAMPTZ,
  "next_due_at"  TIMESTAMPTZ,
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "quibly_topic_mastery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quibly_topic_mastery_user_id_topic_id_key"
  ON "quibly_topic_mastery" ("user_id", "topic_id");
-- A consulta da revisão espaçada da Fase 6: "o que vence hoje para este user".
CREATE INDEX IF NOT EXISTS "quibly_topic_mastery_user_id_next_due_at_idx"
  ON "quibly_topic_mastery" ("user_id", "next_due_at");

-- ── colunas em tabelas existentes ────────────────────────────────────────
-- Todas nullable: nenhuma linha existente precisa de backfill, e nenhum
-- usuário atual fica num estado inválido por ainda não ter escolhido track.
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "country_code"  CHAR(2),
  ADD COLUMN IF NOT EXISTS "exam_track_id" UUID,
  ADD COLUMN IF NOT EXISTS "timezone"      TEXT,
  ADD COLUMN IF NOT EXISTS "exam_date"     DATE;

ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "topic_id" UUID;

CREATE INDEX IF NOT EXISTS "questions_topic_id_idx" ON "questions" ("topic_id");

-- ── chaves estrangeiras ──────────────────────────────────────────────────
-- Em blocos separados para que uma que já exista não aborte as outras.
DO $$ BEGIN
  ALTER TABLE "quibly_exam_tracks" ADD CONSTRAINT "quibly_exam_tracks_country_code_fkey"
    FOREIGN KEY ("country_code") REFERENCES "quibly_countries"("code")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quibly_disciplines" ADD CONSTRAINT "quibly_disciplines_track_id_fkey"
    FOREIGN KEY ("track_id") REFERENCES "quibly_exam_tracks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quibly_topics" ADD CONSTRAINT "quibly_topics_discipline_id_fkey"
    FOREIGN KEY ("discipline_id") REFERENCES "quibly_disciplines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quibly_session_topics" ADD CONSTRAINT "quibly_session_topics_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "study_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quibly_session_topics" ADD CONSTRAINT "quibly_session_topics_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "quibly_topics"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quibly_topic_mastery" ADD CONSTRAINT "quibly_topic_mastery_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quibly_topic_mastery" ADD CONSTRAINT "quibly_topic_mastery_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "quibly_topics"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `SET NULL` nas duas de baixo, não `CASCADE`: desativar um país não pode
-- apagar o perfil de quem o escolheu, e apagar um tópico não pode apagar a
-- questão que estava ligada a ele.
DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_country_code_fkey"
    FOREIGN KEY ("country_code") REFERENCES "quibly_countries"("code")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_exam_track_id_fkey"
    FOREIGN KEY ("exam_track_id") REFERENCES "quibly_exam_tracks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "quibly_topics"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
