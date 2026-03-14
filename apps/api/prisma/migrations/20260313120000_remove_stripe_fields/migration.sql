-- DropIndex
DROP INDEX IF EXISTS "profiles_stripe_customer_id_key";
DROP INDEX IF EXISTS "profiles_stripe_subscription_id_key";

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "stripe_customer_id",
DROP COLUMN IF EXISTS "stripe_subscription_id",
DROP COLUMN IF EXISTS "stripe_price_id";
