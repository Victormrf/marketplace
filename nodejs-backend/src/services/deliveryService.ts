import { DeliveryModel } from "../models/deliveryModel";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export class DeliveryService {
  async createDelivery(
    orderId: string,
    status:
      | "SEPARATED"
      | "PROCESSING"
      | "SHIPPED"
      | "COLLECTED"
      | "ARRIVED_AT_CENTER"
      | "DELIVERED"
      | "FAILED"
      | "RETURNED",
    trackingCode?: string,
    estimatedDelivery?: Date
  ) {
    if (!orderId || !status) {
      throw new ValidationError("Missing required fields");
    }

    const updatedAt = new Date();

    return await DeliveryModel.create({
      orderId,
      status,
      trackingCode,
      estimatedDelivery,
      updatedAt,
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
    const delivery = await DeliveryModel.getByOrderId(orderId);

    if (!delivery) {
      throw new ObjectNotFoundError("Delivery");
    }

    return await DeliveryModel.updateStatus(orderId, status);
  }

  async updateTrackingInfo(
    orderId: string,
    trackingCode: string,
    estimatedDelivery: Date
  ) {
    const delivery = await DeliveryModel.getByOrderId(orderId);

    if (!delivery) {
      throw new ObjectNotFoundError("Delivery");
    }

    return await DeliveryModel.updateTracking(
      orderId,
      trackingCode,
      estimatedDelivery
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
