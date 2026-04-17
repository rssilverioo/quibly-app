-- AlterEnum
ALTER TYPE "timer_mode" ADD VALUE IF NOT EXISTS 'audio';

-- AlterTable
ALTER TABLE "daily_usage" ADD COLUMN "audio_sessions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "audio_clips" (
    "id" UUID NOT NULL,
    "text_hash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voice" TEXT NOT NULL DEFAULT 'alloy',
    "language" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration_sec" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audio_clips_text_hash_key" ON "audio_clips"("text_hash");

-- CreateIndex
CREATE INDEX "audio_clips_language_idx" ON "audio_clips"("language");

-- CreateTable
CREATE TABLE "audio_study_sessions" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "study_session_id" UUID,
    "flashcard_set_id" UUID,
    "language" TEXT NOT NULL,
    "planned_duration_minutes" INTEGER NOT NULL,
    "total_duration_sec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "clips" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ready_at" TIMESTAMPTZ,

    CONSTRAINT "audio_study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audio_study_sessions_study_session_id_key" ON "audio_study_sessions"("study_session_id");

-- CreateIndex
CREATE INDEX "audio_study_sessions_user_id_created_at_idx" ON "audio_study_sessions"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "audio_study_sessions" ADD CONSTRAINT "audio_study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_study_sessions" ADD CONSTRAINT "audio_study_sessions_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
