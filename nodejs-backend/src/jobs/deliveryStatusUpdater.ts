import prisma from "../config/db";
import { DeliveryRepository } from "../repositories/deliveryRepository";
import { DeliveryService } from "../services/deliveryService";
import {
  discoverDeliveryProgressionJobs,
  processDeliveryProgressionJob,
} from "./deliveryProgression";

export async function updateDeliveryStatuses(
  repository: Pick<DeliveryRepository, "findForJob"> = new DeliveryRepository(),
  service: Pick<DeliveryService, "advanceForJob"> = new DeliveryService(),
  now: () => Date = () => new Date(),
): Promise<void> {
  for await (const job of discoverDeliveryProgressionJobs(repository, now)) {
    await processDeliveryProgressionJob(job, service, now());
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
