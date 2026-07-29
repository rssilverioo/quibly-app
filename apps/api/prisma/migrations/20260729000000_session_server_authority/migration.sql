-- Fase 1 / Core — sessão com autoridade no servidor.
--
-- Regra do banco compartilhado (docs/DB-SHARED-RISK.md): tabelas novas nascem
-- com o prefixo `quibly_` e todo DDL é idempotente, porque o schema `public`
-- desta instância também hospeda outro produto.

-- ── stopwatch ────────────────────────────────────────────────────────────
-- Modo cronômetro: sem duração alvo. Adicionar valor a um enum é uma operação
-- de metadado; `IF NOT EXISTS` deixa a migration repetível.
--
-- O Prisma envolve cada migration numa transação. No Postgres 12+ isso é
-- permitido desde que o valor novo não seja *usado* na mesma transação — e
-- não é: nenhum comando abaixo referencia 'stopwatch'. Requer PG >= 12.
ALTER TYPE "timer_mode" ADD VALUE IF NOT EXISTS 'stopwatch';

-- ── heartbeat, pausa e proveniência da duração ───────────────────────────
-- Todas nullable / com default: nenhuma linha existente precisa de backfill,
-- e a coluna nova não trava a tabela por muito tempo no Postgres 11+.
ALTER TABLE "study_sessions"
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "paused_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "end_reason"        TEXT,
  ADD COLUMN IF NOT EXISTS "measured_seconds"  INTEGER;

-- A consulta do sweeper: sessões vivas cujo heartbeat ficou velho.
CREATE INDEX IF NOT EXISTS "study_sessions_status_last_heartbeat_at_idx"
  ON "study_sessions" ("status", "last_heartbeat_at");

-- ── intervalos de pausa ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "quibly_session_pauses" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL,
  "ended_at"   TIMESTAMPTZ,

  CONSTRAINT "quibly_session_pauses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quibly_session_pauses_session_id_idx"
  ON "quibly_session_pauses" ("session_id");

DO $$
BEGIN
  ALTER TABLE "quibly_session_pauses"
    ADD CONSTRAINT "quibly_session_pauses_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "study_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── trilha antifraude ────────────────────────────────────────────────────
-- Só registra. Nada aqui bane, bloqueia ou penaliza ninguém nesta fase.
CREATE TABLE IF NOT EXISTS "quibly_session_anomalies" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    TEXT NOT NULL,
  "session_id" UUID,
  "kind"       TEXT NOT NULL,
  "detail"     JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "quibly_session_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quibly_session_anomalies_user_id_created_at_idx"
  ON "quibly_session_anomalies" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "quibly_session_anomalies_kind_created_at_idx"
  ON "quibly_session_anomalies" ("kind", "created_at" DESC);

DO $$
BEGIN
  ALTER TABLE "quibly_session_anomalies"
    ADD CONSTRAINT "quibly_session_anomalies_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "quibly_session_anomalies"
    ADD CONSTRAINT "quibly_session_anomalies_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "study_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
