import prisma from "../config/db";
import { OrderModel } from "./orderModel";

export class PaymentModel {
  id?: string;
  orderId?: string;
  amount?: number;
  status?: string;
  createdAt?: Date;

  constructor(data: Partial<PaymentModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    orderId: string;
    amount: number;
    status: string;
  }): Promise<OrderModel> {
    return prisma.payment.create({ data });
  }

  static async getById(paymentId: string): Promise<PaymentModel | null> {
    return prisma.payment.findUnique({
      where: { id: paymentId },
    });
  }

  static async getByOrderId(orderId: string): Promise<PaymentModel | null> {
    return prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: true,
      },
    });
  }

  static async getByCustomer(customerId: string): Promise<PaymentModel[] | []> {
    return prisma.payment.findMany({
      where: {
        order: { customerId },
      },
    });
  }

  static async update(
    paymentId: string,
    data: Partial<PaymentModel>
  ): Promise<void> {
    return prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  static async updateStatus(paymentId: string, status: string): Promise<void> {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
  }

  static async delete(paymentId: string) {
    return prisma.payment.delete({
      where: { id: paymentId },
    });
  }

  fill(data: Partial<PaymentModel>) {
    if (data.id !== undefined) this.id = data.id;
    if (data.orderId !== undefined) this.orderId = data.orderId;
    if (data.amount !== undefined) this.amount = data.amount;
    if (data.status !== undefined) this.status = data.status;
    if (data.createdAt !== undefined) this.createdAt = data.createdAt;
  }
}
