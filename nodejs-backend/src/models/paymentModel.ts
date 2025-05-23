import prisma from "../config/db";

export class PaymentModel {
  static async create(data: {
    orderId: string;
    amount: number;
    status: string;
  }) {
    return prisma.payment.create({ data });
  }

  static async getById(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
    });
  }

  static async getByOrderId(orderId: string) {
    return prisma.payment.findUnique({
      where: { orderId },
      include: { order: true },
    });
  }

  static async getByCustomer(customerId: string) {
    return prisma.payment.findMany({
      where: {
        order: { customerId },
      },
    });
  }

  static async update(
    paymentId: string,
    data: Partial<{ amount: number; status: string }>
  ) {
    return prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  static async updateStatus(paymentId: string, status: string) {
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
}
