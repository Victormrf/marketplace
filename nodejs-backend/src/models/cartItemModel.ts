import prisma from "../config/db";

export class CartItemModel {
  static async add(data: {
    userId: string;
    productId: string;
    quantity: number;
  }) {
    return prisma.cart_item.create({ data });
  }

  static async getById(id: string) {
    return prisma.cart_item.findUnique({
      where: { id },
    });
  }

  static async getByUser(userId: string) {
    return prisma.cart_item.findMany({
      where: { userId },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async updateQuantity(id: string, quantity: number) {
    return prisma.cart_item.update({
      where: { id },
      data: { quantity },
    });
  }

  static async delete(id: string) {
    return prisma.cart_item.delete({ where: { id } });
  }

  static async clearCart(userId: string) {
    return prisma.cart_item.deleteMany({ where: { userId } });
  }
}
