import { DeliveryModel } from "../models/deliveryModel";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export class DeliveryService {
  async createDelivery(
    orderId: string,
    status: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "FAILED",
    trackingCode?: string,
    estimatedDate?: Date
  ) {
    if (!orderId || !status) {
      throw new ValidationError("Missing required fields");
    }

    return await DeliveryModel.create({
      orderId,
      status,
      trackingCode,
      estimatedDate,
    });
  }

  async getDeliveryDetails(orderId: string) {
    const delivery = await DeliveryModel.getByOrderId(orderId);

    if (!delivery) {
      throw new ObjectNotFoundError("Delivery");
    }

    return delivery;
  }

  async updateDeliveryStatus(
    orderId: string,
    status: "IN_TRANSIT" | "DELIVERED" | "FAILED"
  ) {
    const delivery = await DeliveryModel.getByOrderId(orderId);

    if (!delivery) {
      throw new ObjectNotFoundError("Delivery");
    }

    return await DeliveryModel.updateStatus(orderId, status);
  }

  async updateTrackingInfo(
    orderId: string,
    trackingCode: string,
    estimatedDate: Date
  ) {
    const delivery = await DeliveryModel.getByOrderId(orderId);

    if (!delivery) {
      throw new ObjectNotFoundError("Delivery");
    }

    return await DeliveryModel.updateTracking(
      orderId,
      trackingCode,
      estimatedDate
    );
  }

  async deleteDelivery(orderId: string) {
    const delivery = await DeliveryModel.getByOrderId(orderId);

    if (!delivery) {
      throw new ObjectNotFoundError("Delivery");
    }

    return await DeliveryModel.delete(orderId);
  }
}
