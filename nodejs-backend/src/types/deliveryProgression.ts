import { createHash } from "node:crypto";
import type { DeliveryStatus } from "@prisma/client";
import { ValidationError } from "../utils/customErrors";

export const AUTOMATIC_DELIVERY_STATUSES = [
  "SEPARATED",
  "PROCESSING",
  "SHIPPED",
  "COLLECTED",
  "ARRIVED_AT_CENTER",
] as const satisfies readonly DeliveryStatus[];

export type AutomaticDeliveryStatus =
  (typeof AUTOMATIC_DELIVERY_STATUSES)[number];

export type DeliveryProgressionJob = {
  version: 1;
  deliveryId: string;
  expectedStatus: AutomaticDeliveryStatus;
  expectedHistoryId: string;
  eligibleBefore: string;
};

export type DeliveryProgressionResult = {
  deliveryId: string;
  outcome: "applied" | "ignored";
};

export function isAutomaticDeliveryStatus(
  value: unknown,
): value is AutomaticDeliveryStatus {
  return AUTOMATIC_DELIVERY_STATUSES.some((status) => status === value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    !/[\s\u0000-\u001f\u007f]/.test(value)
  );
}

export function parseDeliveryProgressionJob(
  payload: unknown,
): DeliveryProgressionJob {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new ValidationError("Invalid delivery progression payload");
  }
  const input = payload as Record<string, unknown>;
  const fields = [
    "version",
    "deliveryId",
    "expectedStatus",
    "expectedHistoryId",
    "eligibleBefore",
  ];
  const date =
    typeof input.eligibleBefore === "string"
      ? new Date(input.eligibleBefore)
      : new Date(NaN);
  if (
    Object.keys(input).length !== fields.length ||
    !fields.every((field) =>
      Object.prototype.hasOwnProperty.call(input, field),
    ) ||
    input.version !== 1 ||
    !isIdentifier(input.deliveryId) ||
    !isIdentifier(input.expectedHistoryId) ||
    !isAutomaticDeliveryStatus(input.expectedStatus) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== input.eligibleBefore
  ) {
    throw new ValidationError("Invalid delivery progression payload");
  }
  return {
    version: 1,
    deliveryId: input.deliveryId,
    expectedStatus: input.expectedStatus,
    expectedHistoryId: input.expectedHistoryId,
    eligibleBefore: date.toISOString(),
  };
}

export function deliveryProgressionJobId(
  payload: DeliveryProgressionJob,
): string {
  const job = parseDeliveryProgressionJob(payload);
  const identity = createHash("sha256")
    .update(JSON.stringify([job.deliveryId, job.expectedHistoryId]))
    .digest("hex");
  // No colon: usable as a future BullMQ jobId, independent of discovery time.
  return `delivery-progression-v1-${identity}`;
}
