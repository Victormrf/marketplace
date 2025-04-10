import { OrderModel } from "../models/orderModel";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

interface OrderData {
  customerId: string;
  totalPrice: number;
  status: string;
}

export class OrderService {
  async createOrder(orderData: { customerId: string; totalPrice: number }) {
    if (!orderData.customerId || orderData.totalPrice === undefined) {
      throw new ValidationError("Missing required fields");
    }

    return await OrderModel.create({
      status: "processed",
      ...orderData,
    });
  }

  async getOrderById(id: string) {
    const order = await OrderModel.getById(id);

    if (!order) {
      throw new ObjectNotFoundError("Order");
    }

    return order;
  }

  async getOrdersByCustomerId(customerId: string) {
    const orders = await OrderModel.getOrdersByCustomerId(customerId);

    if (!orders.length) {
      throw new ObjectsNotFoundError("Orders");
    }

    return orders;
  }

  async updateOrder(id: string, orderData: Partial<OrderData>) {
    const order = await OrderModel.getById(id);

    if (!order) {
      throw new ObjectNotFoundError("Order");
    }

    try {
      return await OrderModel.update(id, orderData);
    } catch (error) {
      throw new Error(`Failed to update order: ${(error as Error).message}`);
    }
  }

  async updateOrderStatus(orderId: string, status: string) {
    const order = await OrderModel.getById(orderId);

    if (!order) {
      throw new ObjectNotFoundError("order");
    }

    try {
      return await OrderModel.updateStatus(orderId, status);
    } catch (error: any) {
      throw new Error(
        `Failed to update order status: ${(error as Error).message}`
      );
    }
  }

  async deleteOrder(id: string) {
    const order = await OrderModel.getById(id);

    if (!order) {
      throw new ObjectNotFoundError("Order");
    }

    return await OrderModel.delete(id);
  }
}
