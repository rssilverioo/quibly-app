-- CreateEnum
CREATE TYPE "lesson_source" AS ENUM ('audio', 'document', 'photo');

-- CreateEnum
CREATE TYPE "lesson_status" AS ENUM ('processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "flashcard_sets" ADD COLUMN     "lesson_id" UUID;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "lesson_id" UUID;

-- CreateTable
CREATE TABLE "captured_lessons" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "source" "lesson_source" NOT NULL,
    "status" "lesson_status" NOT NULL DEFAULT 'processing',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "raw_text" TEXT,
    "summary" TEXT,
    "key_points" JSONB NOT NULL DEFAULT '[]',
    "open_questions" JSONB NOT NULL DEFAULT '[]',
    "audio_key" TEXT,
    "duration_sec" INTEGER,
    "document_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "captured_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "captured_lessons_user_id_created_at_idx" ON "captured_lessons"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "captured_lessons_document_id_idx" ON "captured_lessons"("document_id");

-- CreateIndex
CREATE INDEX "flashcard_sets_lesson_id_idx" ON "flashcard_sets"("lesson_id");

-- CreateIndex
CREATE INDEX "quizzes_lesson_id_idx" ON "quizzes"("lesson_id");

-- AddForeignKey
ALTER TABLE "captured_lessons" ADD CONSTRAINT "captured_lessons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captured_lessons" ADD CONSTRAINT "captured_lessons_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "captured_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "captured_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

