import prisma from "../config/db";
import { DeliveryRepository } from "../repositories/deliveryRepository";
import { DeliveryService } from "../services/deliveryService";
import { ConflictError } from "../utils/customErrors";

const BATCH_SIZE = 100;

export async function updateDeliveryStatuses(): Promise<void> {
  const repository = new DeliveryRepository();
  const service = new DeliveryService(repository);
  let afterId: string | null = null;

  while (true) {
    const deliveries = await repository.findForJob(afterId, BATCH_SIZE);
    if (!deliveries.length) break;

    for (const delivery of deliveries) {
      afterId = delivery.id;
      const latestHistory = delivery.statusHistory[0];
      if (!latestHistory || latestHistory.toStatus !== delivery.status) {
        continue;
      }

      const thresholdHours = delivery.status === "SEPARATED" ? 4 : 24;
      const eligibleBefore = new Date(
        Date.now() - thresholdHours * 60 * 60 * 1000,
      );
      if (latestHistory.changedAt > eligibleBefore) continue;

      await service
        .advanceForJob(
          delivery.id,
          delivery.status,
          eligibleBefore,
          latestHistory.id,
        )
        .catch((error: unknown) => {
          if (error instanceof ConflictError) return;
          throw error;
        });
    }

    if (deliveries.length < BATCH_SIZE) break;
  }
}

if (require.main === module) {
  updateDeliveryStatuses()
    .catch((error: unknown) => {
      console.error("Delivery status job failed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
