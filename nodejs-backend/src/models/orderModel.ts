import prisma from "../config/db";
import { OrderItem } from "./orderItemModel";

export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

interface Order {
  id?: string;
  customerId?: string;
  totalPrice?: number;
  status?: OrderStatus;
  createdAt?: string;
  orderItems?: OrderItem[];
}

export class OrderModel {
  id?: string;
  customerId?: string;
  totalPrice?: number;
  status?: OrderStatus;
  createdAt?: string;

  constructor(data: Partial<OrderModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    customerId: string;
    totalPrice: number;
    status: string;
  }): Promise<OrderModel> {
    return prisma.order.create({
      data: {
        customerId: data.customerId,
        totalPrice: data.totalPrice,
        status: data.status,
      },
    });
  }

  static async getById(id: string): Promise<OrderModel | null> {
    return prisma.order.findUnique({
      where: { id },
    });
  }

  static async getOrdersByCustomerId(
    customerId: string
  ): Promise<OrderModel[]> {
    return prisma.order.findMany({
      where: { customerId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  static async getCompletedOrderItemsBySeller(sellerId: string) {
    const orders = await prisma.order.findMany({
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

    return orders.flatMap((order: Order) => order.orderItems);
  }

  static async getOrdersByStatus(sellerId: string) {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    return prisma.order.findMany({
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
  }

  static async getCompletedOrderItemsByCategory(sellerId: string) {
    const orders = await prisma.order.findMany({
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
    return orders.flatMap((order: Order) => order.orderItems);
  }

  static async getMonthlySalesBySeller(sellerId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Garante o início do mês

    return prisma.order.findMany({
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
  }

  static async getDailySalesBySeller(sellerId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return prisma.order.findMany({
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
  }

  static async getOrdersBySeller(sellerId: string): Promise<OrderModel[]> {
    return prisma.order.findMany({
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
  }

  static async getNewCustomersByMonth(sellerId: string) {
    const result = (await prisma.$queryRawUnsafe(
      `
  SELECT 
    DATE_TRUNC('month', MIN(o."createdAt")) AS month,
    COUNT(DISTINCT o."customerId") AS new_customers
  FROM "order" o
  JOIN "order_item" oi ON oi."orderId" = o."id"
  JOIN "product" p ON p."id" = oi."productId"
  WHERE p."sellerId" = $1
  GROUP BY o."customerId"
  HAVING MIN(o."createdAt") >= NOW() - INTERVAL '6 months'
  `,
      sellerId
    )) as { month: Date; new_customers: number }[];

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
  }

  static async update(id: string, data: Partial<OrderModel>): Promise<void> {
    return prisma.order.update({
      where: { id },
      data,
    });
  }

  static async updateStatus(orderId: string, status: string): Promise<void> {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  static async delete(id: string): Promise<void> {
    return prisma.order.delete({
      where: { id },
    });
  }

  fill(data: Partial<OrderModel>) {
    if (data.id !== undefined) this.id = data.id;
    if (data.customerId !== undefined) this.customerId = data.customerId;
    if (data.totalPrice !== undefined) this.totalPrice = data.totalPrice;
    if (data.status !== undefined) this.status = data.status;
    if (data.createdAt !== undefined) this.createdAt = data.createdAt;
  }
}
