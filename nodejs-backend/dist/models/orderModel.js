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
exports.OrderModel = exports.OrderStatus = void 0;
const db_1 = __importDefault(require("../config/db"));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["PAID"] = "PAID";
    OrderStatus["PROCESSING"] = "PROCESSING";
    OrderStatus["SHIPPED"] = "SHIPPED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["REFUNDED"] = "REFUNDED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
class OrderModel {
    constructor(data = {}) {
        this.fill(data);
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.create({
                data: {
                    customerId: data.customerId,
                    totalPrice: data.totalPrice,
                    status: data.status,
                },
            });
        });
    }
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findUnique({
                where: { id },
            });
        });
    }
    static getOrdersByCustomerId(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findMany({
                where: { customerId },
                include: {
                    orderItems: {
                        include: {
                            product: true,
                        },
                    },
                },
            });
        });
    }
    static getCompletedOrderItemsBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield db_1.default.order.findMany({
                where: {
                    status: "DELIVERED",
                    orderItems: {
                        some: {
                            product: {
                                sellerId,
                            },
                        },
                    },
                },
                select: {
                    orderItems: {
                        where: {
                            product: {
                                sellerId,
                            },
                        },
                        select: {
                            quantity: true,
                            unitPrice: true,
                        },
                    },
                },
            });
            return orders.flatMap((order) => order.orderItems);
        });
    }
    static getOrdersByStatus(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            return db_1.default.order.findMany({
                where: {
                    orderItems: {
                        some: {
                            product: {
                                sellerId,
                            },
                        },
                    },
                    createdAt: {
                        gte: fourteenDaysAgo,
                    },
                },
            });
        });
    }
    static getCompletedOrderItemsByCategory(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield db_1.default.order.findMany({
                where: {
                    status: "DELIVERED",
                    orderItems: {
                        some: {
                            product: {
                                sellerId,
                            },
                        },
                    },
                },
                select: {
                    orderItems: {
                        where: {
                            product: {
                                sellerId,
                            },
                        },
                        select: {
                            quantity: true,
                            unitPrice: true,
                            product: {
                                select: {
                                    category: true,
                                },
                            },
                        },
                    },
                },
            });
            // Flatten the orderItems across all orders
            return orders.flatMap((order) => order.orderItems);
        });
    }
    static getMonthlySalesBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
            sixMonthsAgo.setDate(1); // Garante o início do mês
            return db_1.default.order.findMany({
                where: {
                    status: "DELIVERED",
                    createdAt: {
                        gte: sixMonthsAgo,
                    },
                    orderItems: {
                        some: {
                            product: {
                                sellerId: sellerId,
                            },
                        },
                    },
                },
                select: {
                    totalPrice: true,
                    createdAt: true,
                },
            });
        });
    }
    static getDailySalesBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return db_1.default.order.findMany({
                where: {
                    status: "DELIVERED",
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                    orderItems: {
                        some: {
                            product: {
                                sellerId: sellerId,
                            },
                        },
                    },
                },
                select: {
                    totalPrice: true,
                    createdAt: true,
                },
            });
        });
    }
    static getOrdersBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findMany({
                where: {
                    orderItems: {
                        some: {
                            product: {
                                sellerId: sellerId,
                            },
                        },
                    },
                },
            });
        });
    }
    static getNewCustomersByMonth(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = (yield db_1.default.$queryRawUnsafe(`
  SELECT 
    DATE_TRUNC('month', MIN(o."createdAt")) AS month,
    COUNT(DISTINCT o."customerId") AS new_customers
  FROM "order" o
  JOIN "order_item" oi ON oi."orderId" = o."id"
  JOIN "product" p ON p."id" = oi."productId"
  WHERE p."sellerId" = $1
  GROUP BY o."customerId"
  HAVING MIN(o."createdAt") >= NOW() - INTERVAL '6 months'
  `, sellerId));
            return Array.from({ length: 6 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - (5 - i)); // do mais antigo ao mais recente
                const key = date.toLocaleString("en-US", { month: "short" });
                const found = result.find((r) => {
                    const rMonth = new Date(r.month).toLocaleString("en-US", {
                        month: "short",
                    });
                    return rMonth === key;
                });
                return {
                    month: key,
                    newCustomers: found ? Number(found.new_customers) : 0,
                };
            });
        });
    }
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.update({
                where: { id },
                data,
            });
        });
    }
    static updateStatus(orderId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.update({
                where: { id: orderId },
                data: { status },
            });
        });
    }
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.delete({
                where: { id },
            });
        });
    }
    fill(data) {
        if (data.id !== undefined)
            this.id = data.id;
        if (data.customerId !== undefined)
            this.customerId = data.customerId;
        if (data.totalPrice !== undefined)
            this.totalPrice = data.totalPrice;
        if (data.status !== undefined)
            this.status = data.status;
        if (data.createdAt !== undefined)
            this.createdAt = data.createdAt;
    }
}
exports.OrderModel = OrderModel;
