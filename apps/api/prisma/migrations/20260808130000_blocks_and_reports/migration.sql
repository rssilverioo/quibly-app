-- Bloquear e denunciar: o que o Guideline 1.2 da Apple exige de qualquer app
-- com conteúdo de usuário, e o app tem feed e chat.

CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- Bloquear duas vezes é a mesma decisão, não duas.
CREATE UNIQUE INDEX "user_blocks_user_id_blocked_id_key" ON "user_blocks"("user_id", "blocked_id");
-- A leitura quente é "quem eu bloqueei", feita a cada carga de feed e de chat.
CREATE INDEX "user_blocks_user_id_idx" ON "user_blocks"("user_id");

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey"
    FOREIGN KEY ("blocked_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- Denunciar o mesmo conteúdo de novo é a mesma denúncia.
CREATE UNIQUE INDEX "content_reports_reporter_id_target_type_target_id_key"
    ON "content_reports"("reporter_id", "target_type", "target_id");
-- A fila do painel: pendentes, mais antigas primeiro.
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at");

ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
