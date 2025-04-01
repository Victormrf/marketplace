import prisma from "../config/db";
import { UserModel } from "./userModel";

export class CustomerModel {
  id?: string;
  userId?: string;
  address?: string;
  phone?: string;

  contructor(data: Partial<CustomerModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    userId: string;
    address: string;
    phone: string;
  }): Promise<CustomerModel> {
    return prisma.customer.create({
      data: {
        userId: data.userId,
        address: data.address,
        phone: data.phone,
      },
    });
  }

  static async getByUserId(userId: string): Promise<UserModel> {
    return prisma.customer.findUnique({
      where: { userId },
    });
  }

  fill(data: Partial<CustomerModel>): void {
    if (data.id !== undefined) this.id = data.id;
    if (data.userId !== undefined) this.userId = data.userId;
    if (data.address !== undefined) this.address = data.address;
    if (data.phone !== undefined) this.phone = data.phone;
  }
}
