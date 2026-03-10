-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "apple_original_transaction_id" TEXT,
ADD COLUMN     "apple_product_id" TEXT,
ADD COLUMN     "google_product_id" TEXT,
ADD COLUMN     "google_purchase_token" TEXT,
ADD COLUMN     "subscription_platform" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_apple_original_transaction_id_key" ON "profiles"("apple_original_transaction_id");
