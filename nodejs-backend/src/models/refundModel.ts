import prisma from "../config/db";

export class RefundModel {
  static async create(data: {
    paymentId: string;
    amount: number;
    reason: string;
    status: "REQUESTED" | "APPROVED" | "REJECTED";
  }) {
    return prisma.refund.create({ data });
  }

  static async getById(refundId: string) {
    return prisma.refund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });
  }

  static async getByPaymentId(paymentId: string) {
    return prisma.refund.findMany({
      where: { paymentId },
    });
  }

  static async updateStatus(refundId: string, status: "APPROVED" | "REJECTED") {
    return prisma.refund.update({
      where: { id: refundId },
      data: { status },
    });
  }

  static async delete(refundId: string) {
    return prisma.refund.delete({
      where: { id: refundId },
    });
  }
}
