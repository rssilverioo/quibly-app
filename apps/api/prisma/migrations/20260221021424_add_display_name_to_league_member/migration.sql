-- Add display_name column with a temporary default
ALTER TABLE "league_members" ADD COLUMN "display_name" VARCHAR(30);

-- Backfill existing rows from profile username
UPDATE "league_members" lm
SET "display_name" = p."username"
FROM "profiles" p
WHERE lm."user_id" = p."id" AND lm."display_name" IS NULL;

-- Set fallback for any remaining nulls
UPDATE "league_members" SET "display_name" = 'Member' WHERE "display_name" IS NULL;

-- Make column NOT NULL
ALTER TABLE "league_members" ALTER COLUMN "display_name" SET NOT NULL;
