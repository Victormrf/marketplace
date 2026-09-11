/*
  Warnings:

  - Added the required column `method` to the `payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'PAYPAL');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('NOT_DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "method" "payment_method" NOT NULL;

-- CreateTable
CREATE TABLE "refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "refund_status" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingCode" TEXT,
    "carrier" TEXT,
    "status" "delivery_status" NOT NULL DEFAULT 'NOT_DISPATCHED',
    "estimatedDelivery" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_paymentId_key" ON "refund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orderId_key" ON "delivery"("orderId");

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
