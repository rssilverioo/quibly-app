ALTER TABLE "leagues"
  ADD COLUMN "participation_mode" TEXT NOT NULL DEFAULT 'photo';

ALTER TABLE "leagues"
  ADD CONSTRAINT "leagues_participation_mode_check"
  CHECK ("participation_mode" IN ('photo', 'study'));
