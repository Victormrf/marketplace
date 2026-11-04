import {
  DeliveryConcurrentChangeError,
  DeliveryRepository,
} from "../repositories/deliveryRepository";
import { DeliveryService } from "../services/deliveryService";
import {
  isAutomaticDeliveryStatus,
  parseDeliveryProgressionJob,
} from "../types/deliveryProgression";
import type {
  AutomaticDeliveryStatus,
  DeliveryProgressionJob,
  DeliveryProgressionResult,
} from "../types/deliveryProgression";

const BATCH_SIZE = 100;

function eligibleBefore(status: AutomaticDeliveryStatus, now: Date): Date {
  const hours = status === "SEPARATED" ? 4 : 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export async function* discoverDeliveryProgressionJobs(
  repository: Pick<DeliveryRepository, "findForJob"> = new DeliveryRepository(),
  now: () => Date = () => new Date(),
): AsyncGenerator<DeliveryProgressionJob> {
  let afterId: string | null = null;
  while (true) {
    const deliveries = await repository.findForJob(afterId, BATCH_SIZE);
    if (!deliveries.length) {
      return;
    }
    for (const delivery of deliveries) {
      afterId = delivery.id;
      const history = delivery.statusHistory[0];
      if (
        !isAutomaticDeliveryStatus(delivery.status) ||
        !history ||
        history.toStatus !== delivery.status
      ) {
        continue;
      }
      const cutoff = eligibleBefore(delivery.status, now());
      if (history.changedAt > cutoff) {
        continue;
      }
      yield parseDeliveryProgressionJob({
        version: 1,
        deliveryId: delivery.id,
        expectedStatus: delivery.status,
        expectedHistoryId: history.id,
        eligibleBefore: cutoff.toISOString(),
      });
    }
    if (deliveries.length < BATCH_SIZE) {
      return;
    }
  }
}

export async function processDeliveryProgressionJob(
  payload: unknown,
  service: Pick<DeliveryService, "advanceForJob"> = new DeliveryService(),
  now: Date = new Date(),
): Promise<DeliveryProgressionResult> {
  const job = parseDeliveryProgressionJob(payload);
  // A supplied cutoff is an expectation, never permission to shorten the wait.
  const cutoff = new Date(
    Math.min(
      new Date(job.eligibleBefore).getTime(),
      eligibleBefore(job.expectedStatus, now).getTime(),
    ),
  );
  try {
    const updated = await service.advanceForJob(
      job.deliveryId,
      job.expectedStatus,
      cutoff,
      job.expectedHistoryId,
    );
    return {
      deliveryId: job.deliveryId,
      outcome: updated ? "applied" : "ignored",
    };
  } catch (error) {
    if (error instanceof DeliveryConcurrentChangeError) {
      return { deliveryId: job.deliveryId, outcome: "ignored" };
    }
    // Preserve technical errors and unexpected conflicts for the future worker.
    throw error;
  }
}
