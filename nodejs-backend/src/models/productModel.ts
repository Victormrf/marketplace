import prisma from "../config/db";

export class ProductModel {
  id?: string;
  sellerId?: string;
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  createdAt?: Date;

  constructor(data: Partial<ProductModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    sellerId: string;
    name: string;
    description?: string;
    price: number;
    stock: number;
    category: string;
  }): Promise<ProductModel> {
    return prisma.product.create({
      data: {
        sellerId: data.sellerId,
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        category: data.category,
      },
    });
  }

  static async getById(id: string): Promise<ProductModel> {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  static async getProductBySellerAndName(
    name: string,
    sellerId: string
  ): Promise<ProductModel> {
    return prisma.product.findFirst({
      where: {
        name,
        sellerId,
      },
    });
  }

  static async getProductsBySeller(sellerId: string): Promise<ProductModel[]> {
    return prisma.product.findMany({
      where: {
        sellerId,
      },
      include: {
        seller: {
          select: {
            storeName: true,
          },
        },
      },
    });
  }

  static async getProductsByCategory(
    category: string
  ): Promise<ProductModel[]> {
    return prisma.product.findMany({
      where: {
        category,
      },
      include: {
        seller: {
          select: {
            storeName: true,
          },
        },
      },
    });
  }

  static async getProductsByIds(productIds: string[]): Promise<ProductModel[]> {
    return prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });
  }

  static async update(id: string, data: Partial<ProductModel>): Promise<void> {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  static async updateStock(productId: string, quantity: number) {
    return prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
  }

  static async delete(id: string): Promise<void> {
    return prisma.product.delete({
      where: { id },
    });
  }

  fill(data: Partial<ProductModel>): void {
    this.id = data.id !== undefined ? data.id : undefined;
    this.sellerId = data.sellerId !== undefined ? data.sellerId : undefined;
    this.name = data.name !== undefined ? data.name : undefined;
    this.description =
      data.description !== undefined ? data.description : undefined;
    this.price = data.price !== undefined ? data.price : undefined;
    this.stock = data.stock !== undefined ? data.stock : undefined;
    this.category = data.category !== undefined ? data.category : undefined;
    this.createdAt = data.createdAt !== undefined ? data.createdAt : undefined;
  }
}
