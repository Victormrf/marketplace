-- AlterTable
ALTER TABLE "seller" ADD COLUMN     "logo" TEXT;

-- CreateTable
CREATE TABLE "seller_sales_report" (
    "sellerId" TEXT NOT NULL,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "avgTicket" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_sales_report_pkey" PRIMARY KEY ("sellerId")
);

-- AddForeignKey
ALTER TABLE "seller_sales_report" ADD CONSTRAINT "seller_sales_report_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
