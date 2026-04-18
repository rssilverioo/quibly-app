-- AlterTable
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "education_level" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "study_goal" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "daily_goal_minutes" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_plans" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_plans_user_id_date_key" ON "daily_plans"("user_id", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_plans_user_id_idx" ON "daily_plans"("user_id");

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
