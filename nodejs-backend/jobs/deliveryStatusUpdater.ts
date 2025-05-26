// src/utils/deliveryStatusUpdater.ts
import prisma from "../src/config/db";
import { delivery_status, delivery } from "@prisma/client";

export async function updateDeliveryStatuses(): Promise<void> {
  const deliveries: delivery[] = await prisma.delivery.findMany();

  const statusFlow: Record<delivery_status, delivery_status | null> = {
    SEPARATED: "PROCESSING",
    PROCESSING: "SHIPPED",
    SHIPPED: "COLLECTED",
    COLLECTED: "ARRIVED_AT_CENTER",
    ARRIVED_AT_CENTER: "DELIVERED",
    DELIVERED: null,
    FAILED: null,
    RETURNED: null,
  };

  for (const delivery of deliveries) {
    const nextStatus = statusFlow[delivery.status];
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
      console.log(`🚚 Entrega ${delivery.id} atualizada para ${nextStatus}`);
    }
  }
}
