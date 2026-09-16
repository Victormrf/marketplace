import type { Prisma, SellerOrderStatus } from "@prisma/client";
import prisma from "../config/db";
import type { SellerOrderReadFilters } from "../types/order";

const itemSelect = { id: true, productId: true, quantity: true, unitPriceInCents: true, lineTotalInCents: true, currency: true, productNameSnapshot: true, productReferenceSnapshot: true, sellerNameSnapshot: true } satisfies Prisma.OrderItemSelect;
const historySelect = { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true } satisfies Prisma.SellerOrderStatusHistorySelect;
const detailSelect = { id: true, orderId: true, sellerId: true, status: true, subtotalInCents: true, shippingInCents: true, taxInCents: true, discountInCents: true, totalInCents: true, currency: true, createdAt: true, updatedAt: true, confirmedAt: true, completedAt: true, cancelledAt: true, order: { select: { status: true } }, items: { select: itemSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }, statusHistory: { select: historySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } satisfies Prisma.SellerOrderSelect;
const summarySelect = { id: true, orderId: true, sellerId: true, status: true, totalInCents: true, currency: true, createdAt: true } satisfies Prisma.SellerOrderSelect;
export type SellerOrderSummaryRecord = Prisma.SellerOrderGetPayload<{ select: typeof summarySelect }>;
export type SellerOrderDetailRecord = Prisma.SellerOrderGetPayload<{ select: typeof detailSelect }>;
export type SellerOrderPublicDetailRecord = Omit<SellerOrderDetailRecord, "order">;

function whereFor(sellerId: string, filters: SellerOrderReadFilters): Prisma.SellerOrderWhereInput { return { sellerId, ...(filters.status ? { status: filters.status } : {}), ...(filters.createdFrom || filters.createdTo ? { createdAt: { ...(filters.createdFrom ? { gte: filters.createdFrom } : {}), ...(filters.createdTo ? { lte: filters.createdTo } : {}) } } : {}) }; }

export class SellerOrderRepository {
  async countBySeller(sellerId: string, filters: SellerOrderReadFilters) { return prisma.sellerOrder.count({ where: whereFor(sellerId, filters) }); }
  async findBySeller(sellerId: string, filters: SellerOrderReadFilters, skip: number, take: number): Promise<SellerOrderSummaryRecord[]> { return prisma.sellerOrder.findMany({ where: whereFor(sellerId, filters), select: summarySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }); }
  async findBySellerAndId(sellerId: string, sellerOrderId: string): Promise<SellerOrderDetailRecord | null> { return prisma.sellerOrder.findFirst({ where: { id: sellerOrderId, sellerId }, select: detailSelect }); }
  async findById(sellerOrderId: string): Promise<SellerOrderDetailRecord | null> { return prisma.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: detailSelect }); }
  async transition(sellerOrderId: string, sellerId: string | null, fromStatus: SellerOrderStatus, toStatus: SellerOrderStatus, reason?: string): Promise<SellerOrderDetailRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { status: true, order: { select: { status: true } } } });
      if (!current || current.status !== fromStatus) return null;
      if (current.order.status === "PENDING_PAYMENT" && toStatus !== "CANCELLED") return null;
      const updated = await tx.sellerOrder.updateMany({ where: { id: sellerOrderId, ...(sellerId ? { sellerId } : {}), status: fromStatus }, data: { status: toStatus, ...(toStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {}), ...(toStatus === "DELIVERED" ? { completedAt: new Date() } : {}), ...(toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}) } });
      if (updated.count !== 1) return null;
      await tx.sellerOrderStatusHistory.create({ data: { sellerOrderId, fromStatus, toStatus, reason } });
      return tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: detailSelect });
    });
  }
}
