/*
  Warnings:

  - You are about to drop the column `apple_original_transaction_id` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `apple_product_id` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `google_product_id` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `google_purchase_token` on the `profiles` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "profiles_apple_original_transaction_id_key";

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "apple_original_transaction_id",
DROP COLUMN "apple_product_id",
DROP COLUMN "google_product_id",
DROP COLUMN "google_purchase_token";
