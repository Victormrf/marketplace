import prisma from "../config/db";

export class DeliveryModel {
  static async create(data: {
    orderId: string;
    status: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "FAILED";
    trackingCode?: string;
    estimatedDate?: Date;
  }) {
    return prisma.delivery.create({ data });
  }

  static async getByOrderId(orderId: string) {
    return prisma.delivery.findUnique({
      where: { orderId },
    });
  }

  static async updateStatus(
    orderId: string,
    status: "IN_TRANSIT" | "DELIVERED" | "FAILED"
  ) {
    return prisma.delivery.update({
      where: { orderId },
      data: { status },
    });
  }

  static async updateTracking(
    orderId: string,
    trackingCode: string,
    estimatedDate: Date
  ) {
    return prisma.delivery.update({
      where: { orderId },
      data: { trackingCode, estimatedDate },
    });
  }

  static async delete(orderId: string) {
    return prisma.delivery.delete({
      where: { orderId },
    });
  }
}
