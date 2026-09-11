/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId]` on the table `review` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,sellerId]` on the table `review` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "review_userId_productId_key" ON "review"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "review_userId_sellerId_key" ON "review"("userId", "sellerId");
