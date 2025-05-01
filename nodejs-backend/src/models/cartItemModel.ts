import prisma from "../config/db";

export class CartItemModel {
  static async add(data: {
    userId: string;
    productId: string;
    quantity: number;
  }) {
    const existingItem = await prisma.cart_item.findFirst({
      where: {
        userId: data.userId,
        productId: data.productId,
      },
    });

    if (existingItem) {
      return prisma.cart_item.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + 1,
        },
      });
    } else {
      return prisma.cart_item.create({ data });
    }
  }

  static async getById(id: string) {
    return prisma.cart_item.findUnique({
      where: { id },
    });
  }

  static async getByProductId(productId: string) {
    return prisma.cart_item.findFirst({
      where: { productId },
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
