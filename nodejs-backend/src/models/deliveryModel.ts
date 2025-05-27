import prisma from "../config/db";

export class DeliveryModel {
  static async create(data: {
    orderId: string;
    status:
      | "SEPARATED"
      | "PROCESSING"
      | "SHIPPED"
      | "COLLECTED"
      | "ARRIVED_AT_CENTER"
      | "DELIVERED"
      | "FAILED"
      | "RETURNED";
    trackingCode?: string;
    estimatedDelivery?: Date;
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
    status:
      | "SEPARATED"
      | "PROCESSING"
      | "SHIPPED"
      | "COLLECTED"
      | "ARRIVED_AT_CENTER"
      | "DELIVERED"
      | "FAILED"
      | "RETURNED"
  ) {
    return prisma.delivery.update({
      where: { orderId },
      data: { status },
    });
  }

  static async updateTracking(
    orderId: string,
    trackingCode: string,
    estimatedDelivery: Date
  ) {
    return prisma.delivery.update({
      where: { orderId },
      data: { trackingCode, estimatedDelivery },
    });
  }

  static async delete(orderId: string) {
    return prisma.delivery.delete({
      where: { orderId },
    });
  }
}
