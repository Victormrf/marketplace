import type { DeliveryStatus, Prisma } from "@prisma/client";
import prisma from "../config/db";
import type {
  DeliveryStatusInput,
  DeliveryTrackingInput,
} from "../types/delivery";
import { ConflictError, ObjectNotFoundError } from "../utils/customErrors";

const deliverySelect = {
  id: true,
  sellerOrderId: true,
  trackingCode: true,
  carrier: true,
  status: true,
  estimatedDelivery: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeliverySelect;

const historySelect = {
  id: true,
  deliveryId: true,
  fromStatus: true,
  toStatus: true,
  changedAt: true,
  reason: true,
} satisfies Prisma.DeliveryStatusHistorySelect;

const deliveryJobSelect = {
  ...deliverySelect,
  statusHistory: {
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    take: 1,
    select: historySelect,
  },
} satisfies Prisma.DeliverySelect;

export type DeliveryRecord = Prisma.DeliveryGetPayload<{
  select: typeof deliverySelect;
}>;
export type DeliveryHistoryRecord = Prisma.DeliveryStatusHistoryGetPayload<{
  select: typeof historySelect;
}>;
export type DeliveryJobCandidateRecord = Prisma.DeliveryGetPayload<{
  select: typeof deliveryJobSelect;
}>;

export type DeliveryAccess = {
  customerId?: string;
  sellerId?: string;
  admin?: boolean;
};

function accessWhere(access: DeliveryAccess): Prisma.DeliveryWhereInput {
  if (access.admin) return {};
  return {
    sellerOrder: {
      ...(access.sellerId ? { sellerId: access.sellerId } : {}),
      ...(access.customerId
        ? { order: { customerId: access.customerId } }
        : {}),
    },
  };
}

export class DeliveryRepository {
  constructor(
    private readonly testHooks: {
      beforeHistory?: () => Promise<void> | void;
    } = {},
  ) {}

  async create(
    sellerOrderId: string,
    sellerId: string | null,
    input: DeliveryTrackingInput,
  ): Promise<DeliveryRecord> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const rows = await tx.$queryRaw<
        { id: string; sellerId: string; status: string }[]
      >`SELECT "id", "sellerId", "status" FROM "seller_order" WHERE "id" = ${sellerOrderId} FOR UPDATE`;
      const sellerOrder = rows[0];
      if (
        !sellerOrder ||
        (sellerId !== null && sellerOrder.sellerId !== sellerId)
      ) {
        throw new ObjectNotFoundError("SellerOrder");
      }

      if (
        ["PENDING", "CANCELLED", "RETURNED", "DELIVERED"].includes(
          sellerOrder.status,
        )
      ) {
        throw new ConflictError(
          "SellerOrder is not compatible with delivery creation",
        );
      }

      const existing = await tx.delivery.findUnique({
        where: { sellerOrderId },
        select: { id: true },
      });
      if (existing)
        throw new ConflictError("SellerOrder already has a delivery");

      const delivery = await tx.delivery.create({
        data: {
          sellerOrderId,
          trackingCode: input.trackingCode ?? null,
          carrier: input.carrier ?? null,
          estimatedDelivery: input.estimatedDelivery ?? null,
          status: "SEPARATED",
        },
        select: deliverySelect,
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: delivery.id,
          fromStatus: null,
          toStatus: "SEPARATED",
          reason: null,
        },
      });

      return delivery;
    });
  }

  async findById(
    id: string,
    access: DeliveryAccess = {},
  ): Promise<DeliveryRecord | null> {
    return prisma.delivery.findFirst({
      where: { id, ...accessWhere(access) },
      select: deliverySelect,
    });
  }

  async findBySellerOrder(
    sellerOrderId: string,
    access: DeliveryAccess,
  ): Promise<DeliveryRecord | null> {
    return prisma.delivery.findFirst({
      where: { sellerOrderId, ...accessWhere(access) },
      select: deliverySelect,
    });
  }

  async transition(
    id: string,
    input: DeliveryStatusInput,
    access: DeliveryAccess = {},
    expectedStatus?: DeliveryStatus,
    eligibleBefore?: Date,
    expectedHistoryId?: string,
  ): Promise<DeliveryRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const identity = await tx.delivery.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!identity) return null;

      await tx.$queryRaw`SELECT "id" FROM "delivery" WHERE "id" = ${id} FOR UPDATE`;
      const authorized = await tx.delivery.findFirst({
        where: { id, ...accessWhere(access) },
        select: { id: true },
      });
      if (!authorized) return null;
      const delivery = await tx.delivery.findUnique({
        where: { id },
        select: deliverySelect,
      });
      if (!delivery) return null;
      if (expectedStatus && delivery.status !== expectedStatus) return null;

      if (eligibleBefore || expectedHistoryId) {
        const latestHistory = await tx.deliveryStatusHistory.findFirst({
          where: { deliveryId: id },
          orderBy: [{ changedAt: "desc" }, { id: "desc" }],
          select: historySelect,
        });
        if (
          !latestHistory ||
          latestHistory.toStatus !== delivery.status ||
          (eligibleBefore && latestHistory.changedAt > eligibleBefore) ||
          (expectedHistoryId && latestHistory.id !== expectedHistoryId)
        ) {
          return null;
        }
      }

      if (delivery.status === input.status) return delivery;

      const transitions: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
        SEPARATED: ["PROCESSING", "FAILED"],
        PROCESSING: ["SHIPPED", "FAILED"],
        SHIPPED: ["COLLECTED", "FAILED"],
        COLLECTED: ["ARRIVED_AT_CENTER", "FAILED"],
        ARRIVED_AT_CENTER: ["DELIVERED", "FAILED"],
        DELIVERED: ["RETURNED"],
        FAILED: ["RETURNED"],
        RETURNED: [],
      };
      if (!transitions[delivery.status].includes(input.status)) {
        throw new ConflictError("Invalid delivery transition");
      }

      const updated = await tx.delivery.updateMany({
        where: { id, status: delivery.status },
        data: {
          status: input.status,
          ...(input.status === "DELIVERED" && !delivery.deliveredAt
            ? { deliveredAt: new Date() }
            : {}),
        },
      });
      if (updated.count !== 1)
        throw new ConflictError("Delivery changed concurrently");

      await this.testHooks.beforeHistory?.();
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: id,
          fromStatus: delivery.status,
          toStatus: input.status,
          reason: input.reason ?? null,
        },
      });

      return tx.delivery.findUnique({ where: { id }, select: deliverySelect });
    });
  }

  async updateTracking(
    id: string,
    input: DeliveryTrackingInput,
    access: DeliveryAccess = {},
  ): Promise<DeliveryRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT "id" FROM "delivery" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.delivery.findFirst({
        where: { id, ...accessWhere(access) },
        select: deliverySelect,
      });
      if (!current) return null;
      if (["DELIVERED", "RETURNED", "FAILED"].includes(current.status)) {
        throw new ConflictError(
          "Delivery tracking is not editable in this state",
        );
      }
      return tx.delivery.update({
        where: { id },
        data: input,
        select: deliverySelect,
      });
    });
  }

  async listHistory(id: string): Promise<DeliveryHistoryRecord[]> {
    return prisma.deliveryStatusHistory.findMany({
      where: { deliveryId: id },
      select: historySelect,
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    });
  }

  async findForJob(
    afterId: string | null,
    take: number,
  ): Promise<DeliveryJobCandidateRecord[]> {
    return prisma.delivery.findMany({
      where: {
        id: afterId ? { gt: afterId } : undefined,
        status: { notIn: ["DELIVERED", "RETURNED"] },
      },
      select: deliveryJobSelect,
      orderBy: { id: "asc" },
      take,
    });
  }
}
