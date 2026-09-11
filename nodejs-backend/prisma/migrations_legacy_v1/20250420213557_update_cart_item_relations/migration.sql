/*
  Warnings:

  - You are about to drop the column `userId` on the `cart_item` table. All the data in the column will be lost.
  - Added the required column `customerId` to the `cart_item` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "cart_item" DROP CONSTRAINT "cart_item_userId_fkey";

-- AlterTable
ALTER TABLE "cart_item" DROP COLUMN "userId",
ADD COLUMN     "customerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
