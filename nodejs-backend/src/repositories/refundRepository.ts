import type { Prisma, RefundStatus } from "@prisma/client";
import prisma from "../config/db";
import type { CreateRefundInput, RefundReadFilters } from "../types/refund";
import { ConflictError, ObjectNotFoundError } from "../utils/customErrors";

const refundSelect = {
  id: true,
  paymentAttemptId: true,
  amountInCents: true,
  currency: true,
  reason: true,
  status: true,
  providerReference: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  failedAt: true,
} satisfies Prisma.RefundSelect;
export type RefundRecord = Prisma.RefundGetPayload<{
  select: typeof refundSelect;
}>;
export type RefundWithPaymentRecord = Prisma.RefundGetPayload<{
  select: typeof refundSelect & {
    paymentAttempt: {
      select: {
        providerReference: true;
        amountInCents: true;
        currency: true;
        order: { select: { customerId: true } };
      };
    };
  };
}>;
export type RefundProvisioningRecord = Prisma.RefundGetPayload<{
  select: typeof refundSelect & {
    paymentAttempt: { select: { providerReference: true } };
  };
}>;
function whereFor(filters: RefundReadFilters): Prisma.RefundWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.createdFrom || filters.createdTo
      ? {
          createdAt: {
            ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
            ...(filters.createdTo ? { lte: filters.createdTo } : {}),
          },
        }
      : {}),
  };
}

export class RefundRepository {
  async createRequested(
    customerId: string | null,
    paymentAttemptId: string,
    input: CreateRefundInput,
  ): Promise<RefundRecord> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          status: string;
          amountInCents: number;
          currency: "BRL";
          customerId: string;
          providerReference: string | null;
        }[]
      >`SELECT pa."id", pa."status", pa."amountInCents", pa."currency", o."customerId", pa."providerReference" FROM "payment_attempt" pa JOIN "order" o ON o."id" = pa."orderId" WHERE pa."id" = ${paymentAttemptId} FOR UPDATE`;
      const attempt = rows[0];
      if (
        !attempt ||
        (customerId !== null && attempt.customerId !== customerId)
      )
        throw new ObjectNotFoundError("PaymentAttempt");
      if (attempt.status !== "CAPTURED")
        throw new ConflictError("Refunds require a captured payment attempt");
      if (!attempt.providerReference)
        throw new ConflictError("Captured payment has no provider reference");
      const committed = await tx.refund.aggregate({
        where: {
          paymentAttemptId,
          status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] },
        },
        _sum: { amountInCents: true },
      });
      const used = committed._sum.amountInCents ?? 0;
      if (input.amountInCents > attempt.amountInCents - used)
        throw new ConflictError(
          "Refund exceeds the remaining refundable amount",
        );
      return tx.refund.create({
        data: {
          paymentAttemptId,
          amountInCents: input.amountInCents,
          currency: attempt.currency,
          reason: input.reason ?? null,
        },
        select: refundSelect,
      });
    });
  }
  async findById(id: string): Promise<RefundRecord | null> {
    return prisma.refund.findUnique({ where: { id }, select: refundSelect });
  }
  async findForProvisioning(
    id: string,
  ): Promise<RefundProvisioningRecord | null> {
    return prisma.refund.findUnique({
      where: { id },
      select: {
        ...refundSelect,
        paymentAttempt: { select: { providerReference: true } },
      },
    });
  }
  async findByCustomerAndId(
    customerId: string,
    id: string,
  ): Promise<RefundWithPaymentRecord | null> {
    return prisma.refund.findFirst({
      where: { id, paymentAttempt: { order: { customerId } } },
      select: {
        ...refundSelect,
        paymentAttempt: {
          select: {
            providerReference: true,
            amountInCents: true,
            currency: true,
            order: { select: { customerId: true } },
          },
        },
      },
    });
  }
  async count(
    paymentAttemptId: string,
    filters: RefundReadFilters,
    customerId?: string,
  ): Promise<number> {
    return prisma.refund.count({
      where: {
        ...whereFor(filters),
        paymentAttemptId,
        ...(customerId ? { paymentAttempt: { order: { customerId } } } : {}),
      },
    });
  }
  async findMany(
    paymentAttemptId: string,
    filters: RefundReadFilters,
    skip: number,
    take: number,
    customerId?: string,
  ): Promise<RefundRecord[]> {
    return prisma.refund.findMany({
      where: {
        ...whereFor(filters),
        paymentAttemptId,
        ...(customerId ? { paymentAttempt: { order: { customerId } } } : {}),
      },
      select: refundSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }
  async transition(
    id: string,
    target: RefundStatus,
  ): Promise<RefundRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const identity = await tx.refund.findUnique({
        where: { id },
        select: { paymentAttemptId: true },
      });
      if (!identity) return null;
      await tx.$queryRaw`SELECT "id" FROM "payment_attempt" WHERE "id" = ${identity.paymentAttemptId} FOR UPDATE`;
      const refund = await tx.refund.findUnique({
        where: { id },
        select: refundSelect,
      });
      if (!refund) return null;
      if (refund.status === target) return refund;
      const allowed: Record<RefundStatus, readonly RefundStatus[]> = {
        REQUESTED: ["PROCESSING"],
        PROCESSING: ["COMPLETED", "DECLINED", "FAILED"],
        COMPLETED: [],
        DECLINED: [],
        FAILED: [],
      };
      if (!allowed[refund.status].includes(target))
        throw new ConflictError("Invalid refund transition");
      const data: Prisma.RefundUpdateManyMutationInput = { status: target };
      if (target === "COMPLETED")
        data.completedAt = refund.completedAt ?? new Date();
      if (target === "FAILED") data.failedAt = refund.failedAt ?? new Date();
      const updated = await tx.refund.updateMany({
        where: { id, status: refund.status },
        data,
      });
      if (updated.count !== 1)
        throw new ConflictError("Refund changed concurrently");
      return tx.refund.findUnique({ where: { id }, select: refundSelect });
    });
  }
  async setProviderReference(
    id: string,
    providerReference: string,
  ): Promise<RefundRecord> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.refund.findUnique({
        where: { id },
        select: refundSelect,
      });
      if (!current) throw new ObjectNotFoundError("Refund");
      if (current.providerReference === providerReference) return current;
      if (current.providerReference !== null)
        throw new ConflictError(
          "Refund already has another provider reference",
        );
      const result = await tx.refund.updateMany({
        where: { id, providerReference: null },
        data: { providerReference },
      });
      if (result.count !== 1)
        throw new ConflictError("Refund reference changed concurrently");
      return tx.refund.findUniqueOrThrow({
        where: { id },
        select: refundSelect,
      });
    });
  }
}
