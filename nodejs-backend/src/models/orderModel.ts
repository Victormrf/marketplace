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

  // static async createOrderWithItemsTX(
  //   customerId: string,
  //   items: { productId: string; quantity: number }[]
  // ): Promise<void> {
  //   return await prisma.$transaction(async (tx) => {
  //     const productIds = items.map((item) => item.productId);
  //     const products = await tx.product.findMany({
  //       where: { id: { in: productIds } },
  //       select: { id: true, price: true },
  //     });

  //     const productMap = new Map(
  //       products.map((p: { id: string; price: number }) => [p.id, p.price])
  //     );

  //     // Calcular o totalPrice
  //     let totalPrice = 0;
  //     const orderItemsData = items.map(({ productId, quantity }) => {
  //       const unitPrice = productMap.get(productId);
  //       if (unitPrice === undefined) {
  //         throw new ValidationError(`Product ${productId} not found.`);
  //       }

  //       const itemTotal = unitPrice * quantity;
  //       totalPrice += itemTotal;

  //       return {
  //         productId,
  //         quantity,
  //         unitPrice,
  //       };
  //     });
  //   });
  // }

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
