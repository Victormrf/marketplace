import prisma from "../config/db";

export class OrderModel {
  id?: string;
  customerId?: string;
  totalPrice?: number;
  status?: string;
  createdAt?: string;

  constructor(data: Partial<OrderModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    customerId: string;
    totalPrice: number;
    status: string;
  }): Promise<OrderModel> {
    return prisma.order.create(data);
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
        status: "completed",
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

  static async update(id: string, data: Partial<OrderModel>): Promise<void> {
    return prisma.order.update({
      where: { id },
      data,
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
