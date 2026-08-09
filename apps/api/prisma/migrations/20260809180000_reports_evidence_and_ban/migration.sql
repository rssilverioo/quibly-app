-- A prova, fotografada no instante da denúncia.
--
-- Sem ela a denúncia é só um ponteiro, e apagar o conteúdo denunciado apaga a
-- própria evidência — que é exatamente o que alguém denunciado faz.
ALTER TABLE "content_reports" ADD COLUMN "snapshot_text" VARCHAR(2000);
ALTER TABLE "content_reports" ADD COLUMN "snapshot_author_id" TEXT;
ALTER TABLE "content_reports" ADD COLUMN "snapshot_author_name" TEXT;
ALTER TABLE "content_reports" ADD COLUMN "snapshot_at" TIMESTAMPTZ;
ALTER TABLE "content_reports" ADD COLUMN "snapshot_room_id" TEXT;

-- Quem julgou, quando, e por quê.
ALTER TABLE "content_reports" ADD COLUMN "reviewed_at" TIMESTAMPTZ;
ALTER TABLE "content_reports" ADD COLUMN "reviewed_by" TEXT;
ALTER TABLE "content_reports" ADD COLUMN "review_note" VARCHAR(500);

-- Suspensão da conta. Reversível de propósito: apagar levaria junto os posts
-- que a pessoa deixou nas salas de outras.
ALTER TABLE "profiles" ADD COLUMN "banned_at" TIMESTAMPTZ;
ALTER TABLE "profiles" ADD COLUMN "banned_reason" VARCHAR(500);
