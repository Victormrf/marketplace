import type { Prisma, OrderStatus } from "@prisma/client";
import prisma from "../config/db";
import type { OrderReadFilters } from "../types/order";

const itemSelect = {
  id: true,
  productId: true,
  quantity: true,
  unitPriceInCents: true,
  lineTotalInCents: true,
  currency: true,
  productNameSnapshot: true,
  productReferenceSnapshot: true,
  sellerNameSnapshot: true,
} satisfies Prisma.OrderItemSelect;

const orderHistorySelect = {
  id: true,
  fromStatus: true,
  toStatus: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.OrderStatusHistorySelect;

const sellerHistorySelect = {
  id: true,
  fromStatus: true,
  toStatus: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.SellerOrderStatusHistorySelect;

const sellerDetailSelect = {
  id: true,
  orderId: true,
  sellerId: true,
  status: true,
  subtotalInCents: true,
  shippingInCents: true,
  taxInCents: true,
  discountInCents: true,
  totalInCents: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  confirmedAt: true,
  completedAt: true,
  cancelledAt: true,
  items: {
    select: itemSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
  statusHistory: {
    select: sellerHistorySelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
} satisfies Prisma.SellerOrderSelect;

const orderSummarySelect = {
  id: true,
  status: true,
  totalInCents: true,
  currency: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  id: true,
  customerId: true,
  status: true,
  subtotalInCents: true,
  shippingInCents: true,
  taxInCents: true,
  discountInCents: true,
  totalInCents: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  confirmedAt: true,
  completedAt: true,
  cancelledAt: true,
  address: {
    select: {
      id: true,
      sourceAddressId: true,
      recipientName: true,
      postalCode: true,
      street: true,
      number: true,
      complement: true,
      neighborhood: true,
      city: true,
      state: true,
      countryCode: true,
      phone: true,
      createdAt: true,
    },
  },
  sellerOrders: {
    select: sellerDetailSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
  statusHistory: {
    select: orderHistorySelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
} satisfies Prisma.OrderSelect;

export type OrderSummaryRecord = Prisma.OrderGetPayload<{
  select: typeof orderSummarySelect;
}>;
export type OrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof orderDetailSelect;
}>;

function orderWhere(
  customerId: string,
  filters: OrderReadFilters,
): Prisma.OrderWhereInput {
  return {
    customerId,
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

export class OrderRepository {
  constructor(
    private readonly testHooks: {
      beforeOrderHistory?: () => Promise<void> | void;
    } = {},
  ) {}
  async countByCustomer(customerId: string, filters: OrderReadFilters) {
    return prisma.order.count({ where: orderWhere(customerId, filters) });
  }
  async findByCustomer(
    customerId: string,
    filters: OrderReadFilters,
    skip: number,
    take: number,
  ): Promise<OrderSummaryRecord[]> {
    return prisma.order.findMany({
      where: orderWhere(customerId, filters),
      select: orderSummarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }
  async findByCustomerAndId(
    customerId: string,
    orderId: string,
  ): Promise<OrderDetailRecord | null> {
    return prisma.order.findFirst({
      where: { id: orderId, customerId },
      select: orderDetailSelect,
    });
  }
  async findById(orderId: string): Promise<OrderDetailRecord | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });
  }

  async getCompletedOrderItemsBySeller(sellerId: string) {
    return prisma.orderItem.findMany({
      where: { sellerOrder: { sellerId, status: "DELIVERED" } },
      select: { quantity: true, unitPriceInCents: true },
    });
  }

  async getOrdersByStatus(sellerId: string) {
    return prisma.sellerOrder.findMany({
      where: {
        sellerId,
        createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
      },
      select: { status: true },
    });
  }

  async getCompletedOrderItemsByCategory(sellerId: string) {
    return prisma.orderItem.findMany({
      where: { sellerOrder: { sellerId, status: "DELIVERED" } },
      select: {
        quantity: true,
        unitPriceInCents: true,
        product: { select: { category: true } },
      },
    });
  }
  async getMonthlySalesBySeller(sellerId: string) {
    return prisma.sellerOrder.findMany({
      where: {
        sellerId,
        status: "DELIVERED",
        createdAt: {
          gte: new Date(new Date().setMonth(new Date().getMonth() - 5)),
        },
      },
      select: { totalInCents: true, createdAt: true },
    });
  }
  async getDailySalesBySeller(sellerId: string) {
    return prisma.sellerOrder.findMany({
      where: {
        sellerId,
        status: "DELIVERED",
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      select: { totalInCents: true, createdAt: true },
    });
  }
  async getOrdersBySeller(sellerId: string) {
    return prisma.sellerOrder.findMany({
      where: { sellerId },
      select: {
        id: true,
        orderId: true,
        status: true,
        totalInCents: true,
        createdAt: true,
      },
    });
  }
  async getBestSellingProductsBySeller(sellerId: string) {
    return prisma.orderItem.groupBy({
      by: ["productId"],
      where: { sellerOrder: { sellerId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });
  }
  async getNewCustomersByMonth(sellerId: string) {
    const result = await prisma.$queryRaw<
      { month: Date; new_customers: bigint }[]
    >`SELECT DATE_TRUNC('month', MIN(o."createdAt")) AS month, COUNT(DISTINCT o."customerId") AS new_customers FROM "order" o JOIN "seller_order" so ON so."orderId" = o."id" WHERE so."sellerId" = ${sellerId} GROUP BY o."customerId" HAVING MIN(o."createdAt") >= NOW() - INTERVAL '6 months'`;
    return result.map((r: { month: Date; new_customers: bigint }) => ({
      month: r.month,
      newCustomers: Number(r.new_customers),
    }));
  }

  async transition(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    reason?: string,
  ): Promise<OrderDetailRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!current || current.status !== fromStatus) return null;
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: fromStatus },
        data: {
          status: toStatus,
          ...(toStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
          ...(toStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
          ...(toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        },
      });
      if (updated.count !== 1) return null;
      await this.testHooks.beforeOrderHistory?.();
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus, toStatus, reason },
      });
      return tx.order.findUnique({
        where: { id: orderId },
        select: orderDetailSelect,
      });
    });
  }
}
