import prisma from "../config/db";

export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
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
    });
  }

  static async getCompletedOrdersBySeller(
    sellerId: string
  ): Promise<OrderModel[]> {
    return prisma.order.findMany({
      where: {
        status: "DELIVERED",
        orderItems: {
          some: {
            product: {
              sellerId: sellerId,
            },
          },
        },
      },
      include: {
        orderItems: true,
      },
    });
  }

  static async getCompletedOrdersByCategory(sellerId: string) {
    return prisma.order.findMany({
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
