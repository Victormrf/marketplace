// src/utils/deliveryStatusUpdater.ts
import prisma from "../src/config/db";

enum delivery_status {
  SEPARATED = "SEPARATED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  COLLECTED = "COLLECTED",
  ARRIVED_AT_CENTER = "ARRIVED_AT_CENTER",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  RETURNED = "RETURNED",
}

export async function updateDeliveryStatuses(): Promise<void> {
  const deliveries = await prisma.delivery.findMany();

  const statusFlow: Record<delivery_status, delivery_status | null> = {
    SEPARATED: delivery_status.PROCESSING,
    PROCESSING: delivery_status.SHIPPED,
    SHIPPED: delivery_status.COLLECTED,
    COLLECTED: delivery_status.ARRIVED_AT_CENTER,
    ARRIVED_AT_CENTER: delivery_status.DELIVERED,
    DELIVERED: null,
    FAILED: null,
    RETURNED: null,
  };

  for (const delivery of deliveries) {
    const nextStatus = statusFlow[delivery.status as delivery_status];
    if (!nextStatus) continue;

    const hoursSinceUpdate =
      (Date.now() - new Date(delivery.updatedAt).getTime()) / (1000 * 60 * 60);

    const shouldUpdate =
      (delivery.status === "SEPARATED" && hoursSinceUpdate >= 4) ||
      (delivery.status !== "SEPARATED" && hoursSinceUpdate >= 24);

    if (shouldUpdate) {
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
        },
      });

      await prisma.deliveryStatusLog.create({
        data: {
          deliveryId: delivery.id,
          status: nextStatus,
        },
      });
      console.log(`🚚 Entrega ${delivery.id} atualizada para ${nextStatus}`);
    }
  }
}
