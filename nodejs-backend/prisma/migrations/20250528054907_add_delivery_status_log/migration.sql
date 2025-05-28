-- CreateTable
CREATE TABLE "DeliveryStatusLog" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" "delivery_status" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryStatusLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DeliveryStatusLog" ADD CONSTRAINT "DeliveryStatusLog_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
