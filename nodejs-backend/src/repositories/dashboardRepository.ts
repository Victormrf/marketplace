import type { Prisma, SellerOrderStatus } from "@prisma/client";
import prisma from "../config/db";
import type {
  DashboardCategoryDto,
  DashboardDateRange,
  DashboardNewCustomersDto,
  DashboardTimeseriesDto,
  DashboardTopProductDto,
  SellerDashboardOrderDto,
} from "../types/dashboard";

const orderSelect = {
  id: true,
  status: true,
  totalInCents: true,
  currency: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.SellerOrderSelect;

export type DashboardOrderRecord = Prisma.SellerOrderGetPayload<{
  select: typeof orderSelect;
}>;

function orderWhere(
  sellerId: string,
  range: DashboardDateRange,
  status?: SellerOrderStatus,
): Prisma.SellerOrderWhereInput {
  return {
    sellerId,
    ...(status ? { status } : {}),
    createdAt: { gte: range.from, lt: range.toExclusive },
  };
}

export class DashboardRepository {
  async summary(sellerId: string, range: DashboardDateRange) {
    const [orders, items] = await Promise.all([
      prisma.sellerOrder.aggregate({
        where: {
          sellerId,
          status: "DELIVERED",
          completedAt: { gte: range.from, lt: range.toExclusive },
        },
        _sum: { totalInCents: true },
        _count: { id: true },
      }),
      prisma.orderItem.aggregate({
        where: {
          sellerOrder: {
            sellerId,
            status: "DELIVERED",
            completedAt: { gte: range.from, lt: range.toExclusive },
          },
        },
        _sum: { quantity: true },
      }),
    ]);
    return {
      grossRevenueInCents: orders._sum.totalInCents ?? 0,
      deliveredSellerOrders: orders._count.id,
      itemsSold: items._sum.quantity ?? 0,
    };
  }

  async countOrders(
    sellerId: string,
    range: DashboardDateRange,
    status?: SellerOrderStatus,
  ): Promise<number> {
    return prisma.sellerOrder.count({ where: orderWhere(sellerId, range, status) });
  }

  async findOrders(
    sellerId: string,
    range: DashboardDateRange,
    skip: number,
    take: number,
    status?: SellerOrderStatus,
  ): Promise<DashboardOrderRecord[]> {
    return prisma.sellerOrder.findMany({
      where: orderWhere(sellerId, range, status),
      select: orderSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }

  async countByStatus(
    sellerId: string,
    range: DashboardDateRange,
  ): Promise<Array<{ status: SellerOrderStatus; count: number }>> {
    const rows = await prisma.sellerOrder.groupBy({
      by: ["status"],
      where: orderWhere(sellerId, range),
      _count: { id: true },
    });
    return rows.map(
      (row: { status: SellerOrderStatus; _count: { id: number } }) => ({
        status: row.status,
        count: row._count.id,
      }),
    );
  }

  async timeseries(
    sellerId: string,
    range: DashboardDateRange,
    interval: "day" | "month",
  ): Promise<DashboardTimeseriesDto[]> {
    if (interval === "day") {
      const rows = await prisma.$queryRaw<
        Array<{ period: string; grossRevenueInCents: bigint; sellerOrders: bigint }>
      >`WITH periods AS (
          SELECT generate_series(
            date_trunc('day', ${range.from}),
            date_trunc('day', ${range.toExclusive} - interval '1 second'),
            interval '1 day'
          ) AS period
        )
        SELECT to_char(periods.period, 'YYYY-MM-DD') AS period,
          COALESCE(SUM(so."totalInCents"), 0)::bigint AS "grossRevenueInCents",
          COUNT(so.id)::bigint AS "sellerOrders"
        FROM periods
        LEFT JOIN "seller_order" so
          ON so."sellerId" = ${sellerId}
          AND so.status = 'DELIVERED'
          AND so."completedAt" >= ${range.from}
          AND so."completedAt" < ${range.toExclusive}
          AND so."completedAt" >= periods.period
          AND so."completedAt" < periods.period + interval '1 day'
        GROUP BY periods.period
        ORDER BY periods.period ASC`;
      return rows.map((row: { period: string; grossRevenueInCents: bigint; sellerOrders: bigint }) => ({
        period: row.period,
        grossRevenueInCents: Number(row.grossRevenueInCents),
        sellerOrders: Number(row.sellerOrders),
      }));
    }
    const rows = await prisma.$queryRaw<
      Array<{ period: string; grossRevenueInCents: bigint; sellerOrders: bigint }>
    >`WITH periods AS (
        SELECT generate_series(
          date_trunc('month', ${range.from}),
          date_trunc('month', ${range.toExclusive} - interval '1 second'),
          interval '1 month'
        ) AS period
      )
      SELECT to_char(periods.period, 'YYYY-MM') AS period,
        COALESCE(SUM(so."totalInCents"), 0)::bigint AS "grossRevenueInCents",
        COUNT(so.id)::bigint AS "sellerOrders"
      FROM periods
        LEFT JOIN "seller_order" so
          ON so."sellerId" = ${sellerId}
          AND so.status = 'DELIVERED'
          AND so."completedAt" >= ${range.from}
          AND so."completedAt" < ${range.toExclusive}
          AND so."completedAt" >= periods.period
          AND so."completedAt" < periods.period + interval '1 month'
      GROUP BY periods.period
      ORDER BY periods.period ASC`;
    return rows.map((row: { period: string; grossRevenueInCents: bigint; sellerOrders: bigint }) => ({
      period: row.period,
      grossRevenueInCents: Number(row.grossRevenueInCents),
      sellerOrders: Number(row.sellerOrders),
    }));
  }

  async byCategory(
    sellerId: string,
    range: DashboardDateRange,
  ): Promise<DashboardCategoryDto[]> {
    const rows = await prisma.$queryRaw<
      Array<{ category: string; grossRevenueInCents: bigint; itemsSold: bigint }>
    >`SELECT p.category,
        COALESCE(SUM(oi."lineTotalInCents"), 0)::bigint AS "grossRevenueInCents",
        COALESCE(SUM(oi.quantity), 0)::bigint AS "itemsSold"
      FROM "order_item" oi
      JOIN "seller_order" so ON so.id = oi."sellerOrderId"
      JOIN product p ON p.id = oi."productId"
      WHERE so."sellerId" = ${sellerId}
        AND so.status = 'DELIVERED'
        AND so."completedAt" >= ${range.from}
        AND so."completedAt" < ${range.toExclusive}
      GROUP BY p.category
      ORDER BY p.category ASC`;
    return rows.map((row: { category: string; grossRevenueInCents: bigint; itemsSold: bigint }) => ({
      category: row.category,
      grossRevenueInCents: Number(row.grossRevenueInCents),
      itemsSold: Number(row.itemsSold),
    }));
  }

  async topProducts(
    sellerId: string,
    range: DashboardDateRange,
    limit: number,
  ): Promise<DashboardTopProductDto[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        itemsSold: bigint;
        grossRevenueInCents: bigint;
      }>
    >`WITH eligible_items AS (
        SELECT oi.id,
          oi."productId",
          oi."productNameSnapshot",
          oi.quantity,
          oi."lineTotalInCents",
          oi."createdAt"
        FROM "order_item" oi
        JOIN "seller_order" so ON so.id = oi."sellerOrderId"
        WHERE so."sellerId" = ${sellerId}
          AND so.status = 'DELIVERED'
          AND so."completedAt" >= ${range.from}
          AND so."completedAt" < ${range.toExclusive}
      ), aggregates AS (
        SELECT "productId",
          COALESCE(SUM(quantity), 0)::bigint AS "itemsSold",
          COALESCE(SUM("lineTotalInCents"), 0)::bigint AS "grossRevenueInCents"
        FROM eligible_items
        GROUP BY "productId"
      ), latest_names AS (
        SELECT DISTINCT ON ("productId")
          "productId",
          "productNameSnapshot" AS "productName"
        FROM eligible_items
        ORDER BY "productId", "createdAt" DESC, id DESC
      )
      SELECT aggregates."productId",
        latest_names."productName",
        aggregates."itemsSold",
        aggregates."grossRevenueInCents"
      FROM aggregates
      JOIN latest_names USING ("productId")
      ORDER BY "itemsSold" DESC, "grossRevenueInCents" DESC, aggregates."productId" ASC
      LIMIT ${limit}`;
    return rows.map((row: { productId: string; productName: string; itemsSold: bigint; grossRevenueInCents: bigint }) => ({
      productId: row.productId,
      productName: row.productName,
      itemsSold: Number(row.itemsSold),
      grossRevenueInCents: Number(row.grossRevenueInCents),
    }));
  }

  async newCustomers(
    sellerId: string,
    range: DashboardDateRange,
  ): Promise<DashboardNewCustomersDto[]> {
    const rows = await prisma.$queryRaw<
      Array<{ period: string; newCustomers: bigint }>
    >`WITH first_orders AS (
        SELECT o."customerId", MIN(so."createdAt") AS first_created_at
        FROM "seller_order" so
        JOIN "order" o ON o.id = so."orderId"
        WHERE so."sellerId" = ${sellerId}
        GROUP BY o."customerId"
      )
      SELECT to_char(date_trunc('month', first_created_at), 'YYYY-MM') AS period,
        COUNT(*)::bigint AS "newCustomers"
      FROM first_orders
      WHERE first_created_at >= ${range.from}
        AND first_created_at < ${range.toExclusive}
      GROUP BY date_trunc('month', first_created_at)
      ORDER BY date_trunc('month', first_created_at) ASC`;
    return rows.map((row: { period: string; newCustomers: bigint }) => ({
      period: row.period,
      newCustomers: Number(row.newCustomers),
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
