"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRepository = exports.DashboardRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const orderSelect = {
    id: true,
    status: true,
    totalInCents: true,
    currency: true,
    createdAt: true,
    completedAt: true,
};
function orderWhere(sellerId, range, status) {
    return Object.assign(Object.assign({ sellerId }, (status ? { status } : {})), { createdAt: { gte: range.from, lt: range.toExclusive } });
}
class DashboardRepository {
    summary(sellerId, range) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const [orders, items] = yield Promise.all([
                db_1.default.sellerOrder.aggregate({
                    where: {
                        sellerId,
                        status: "DELIVERED",
                        completedAt: { gte: range.from, lt: range.toExclusive },
                    },
                    _sum: { totalInCents: true },
                    _count: { id: true },
                }),
                db_1.default.orderItem.aggregate({
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
                grossRevenueInCents: (_a = orders._sum.totalInCents) !== null && _a !== void 0 ? _a : 0,
                deliveredSellerOrders: orders._count.id,
                itemsSold: (_b = items._sum.quantity) !== null && _b !== void 0 ? _b : 0,
            };
        });
    }
    countOrders(sellerId, range, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.sellerOrder.count({ where: orderWhere(sellerId, range, status) });
        });
    }
    findOrders(sellerId, range, skip, take, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.sellerOrder.findMany({
                where: orderWhere(sellerId, range, status),
                select: orderSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip,
                take,
            });
        });
    }
    countByStatus(sellerId, range) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield db_1.default.sellerOrder.groupBy({
                by: ["status"],
                where: orderWhere(sellerId, range),
                _count: { id: true },
            });
            return rows.map((row) => ({
                status: row.status,
                count: row._count.id,
            }));
        });
    }
    timeseries(sellerId, range, interval) {
        return __awaiter(this, void 0, void 0, function* () {
            if (interval === "day") {
                const rows = yield db_1.default.$queryRaw `WITH periods AS (
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
                return rows.map((row) => ({
                    period: row.period,
                    grossRevenueInCents: Number(row.grossRevenueInCents),
                    sellerOrders: Number(row.sellerOrders),
                }));
            }
            const rows = yield db_1.default.$queryRaw `WITH periods AS (
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
            return rows.map((row) => ({
                period: row.period,
                grossRevenueInCents: Number(row.grossRevenueInCents),
                sellerOrders: Number(row.sellerOrders),
            }));
        });
    }
    byCategory(sellerId, range) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield db_1.default.$queryRaw `SELECT p.category,
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
            return rows.map((row) => ({
                category: row.category,
                grossRevenueInCents: Number(row.grossRevenueInCents),
                itemsSold: Number(row.itemsSold),
            }));
        });
    }
    topProducts(sellerId, range, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield db_1.default.$queryRaw `WITH eligible_items AS (
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
            return rows.map((row) => ({
                productId: row.productId,
                productName: row.productName,
                itemsSold: Number(row.itemsSold),
                grossRevenueInCents: Number(row.grossRevenueInCents),
            }));
        });
    }
    newCustomers(sellerId, range) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield db_1.default.$queryRaw `WITH first_orders AS (
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
            return rows.map((row) => ({
                period: row.period,
                newCustomers: Number(row.newCustomers),
            }));
        });
    }
}
exports.DashboardRepository = DashboardRepository;
exports.dashboardRepository = new DashboardRepository();
