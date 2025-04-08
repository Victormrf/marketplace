import prisma from "../config/db";

export class OrderItemModel {
  id?: string;
  orderId?: string;
  productId?: string;
  quantity?: number;
  createdAt?: Date;

  constructor(data: Partial<OrderItemModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    orderId: string;
    productId: string;
    quantity: number;
  }): Promise<OrderItemModel> {
    return prisma.order_item.create({
      data: {
        orderId: data.orderId,
        productId: data.productId,
        quantity: data.quantity,
      },
    });
  }

  static async getById(id: string): Promise<OrderItemModel | null> {
    return prisma.order_item.findUnique({
      where: { id },
    });
  }

  static async getByOrderId(orderId: string): Promise<OrderItemModel[]> {
    return prisma.order_item.findMany({
      where: { orderId },
    });
  }

  static async getBestSellingProductsBySeller(
    sellerId: string
  ): Promise<OrderItemModel[]> {
    return prisma.order_item.groupBy({
      by: ["productId"],
      where: {
        product: {
          sellerId: sellerId,
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5, // ou qualquer número que represente os "mais vendidos"
    });
  }

  static async updateQuantity(itemId: string, quantity: number) {
    return prisma.order_item.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  static async delete(id: string): Promise<void> {
    await prisma.order_item.delete({
      where: { id },
    });
  }

  fill(data: Partial<OrderItemModel>): void {
    if (data.id !== undefined) this.id = data.id;
    if (data.orderId !== undefined) this.orderId = data.orderId;
    if (data.productId !== undefined) this.productId = data.productId;
    if (data.quantity !== undefined) this.quantity = data.quantity;
    if (data.createdAt !== undefined) this.createdAt = data.createdAt;
  }
}
