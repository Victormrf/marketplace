/*
  Warnings:

  - The values [NOT_DISPATCHED,IN_TRANSIT,OUT_FOR_DELIVERY] on the enum `delivery_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "delivery_status_new" AS ENUM ('SEPARATED', 'PROCESSING', 'SHIPPED', 'COLLECTED', 'ARRIVED_AT_CENTER', 'DELIVERED', 'FAILED', 'RETURNED');
ALTER TABLE "delivery" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "delivery" ALTER COLUMN "status" TYPE "delivery_status_new" USING ("status"::text::"delivery_status_new");
ALTER TYPE "delivery_status" RENAME TO "delivery_status_old";
ALTER TYPE "delivery_status_new" RENAME TO "delivery_status";
DROP TYPE "delivery_status_old";
ALTER TABLE "delivery" ALTER COLUMN "status" SET DEFAULT 'SEPARATED';
COMMIT;

-- AlterTable
ALTER TABLE "delivery" ALTER COLUMN "status" SET DEFAULT 'SEPARATED';
