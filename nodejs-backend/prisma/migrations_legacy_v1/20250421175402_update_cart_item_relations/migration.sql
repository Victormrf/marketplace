/*
  Warnings:

  - You are about to drop the column `customerId` on the `cart_item` table. All the data in the column will be lost.
  - Added the required column `userId` to the `cart_item` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "cart_item" DROP CONSTRAINT "cart_item_customerId_fkey";

-- AlterTable
ALTER TABLE "cart_item" DROP COLUMN "customerId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
