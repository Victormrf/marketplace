import prisma from "../config/db";
import { UserModel } from "./userModel";

export class SellerModel {
  id?: string;
  userId?: string;
  storeName?: string;
  logo?: string;
  description?: string;

  constructor(data: Partial<SellerModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    userId: string;
    storeName: string;
    description: string;
  }): Promise<SellerModel> {
    return prisma.seller.create({
      data: {
        userId: data.userId,
        storeName: data.storeName,
        description: data.description,
      },
    });
  }

  static async getByUserId(userId: string): Promise<UserModel> {
    return prisma.seller.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  static async getAllSellers(): Promise<SellerModel[]> {
    return prisma.seller.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  static async updateSeller(
    userId: string,
    data: { storeName?: string; description?: string }
  ): Promise<void> {
    return prisma.seller.update({
      where: { userId },
      data,
    });
  }

  static async deleteSeller(userId: string): Promise<void> {
    return prisma.seller.delete({
      where: { userId },
    });
  }

  fill(data: Partial<SellerModel>): void {
    if (data.id !== undefined) this.id = data.id;
    if (data.userId !== undefined) this.userId = data.userId;
    if (data.logo !== undefined) this.logo = data.logo;
    if (data.storeName !== undefined) this.storeName = data.storeName;
    if (data.description !== undefined) this.description = data.description;
  }
}
