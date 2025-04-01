import prisma from "../config/db";
import { UserModel } from "./userModel";

export class SellerModel {
  id?: string;
  userId?: string;
  storeName?: string;
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
    });
  }

  fill(data: Partial<SellerModel>): void {
    if (data.id !== undefined) this.id = data.id;
    if (data.userId !== undefined) this.userId = data.userId;
    if (data.storeName !== undefined) this.storeName = data.storeName;
    if (data.description !== undefined) this.description = data.description;
  }
}
