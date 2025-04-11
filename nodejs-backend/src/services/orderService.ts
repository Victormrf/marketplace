import prisma from "../config/db";
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

interface OrderItemInput {
  productId: string;
  quantity: number;
}

export class OrderService {
  async createOrderWithItems(customerId: string, items: OrderItemInput[]) {
    if (!customerId || !items?.length) {
      throw new ValidationError("Customer ID and items are required.");
    }

    return await prisma.$transaction(async (tx: any) => {
      // Buscar os preços dos produtos
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, price: true },
      });

      const productMap: Map<string, number> = new Map(
        products.map((p: { id: string; price: number }) => [p.id, p.price])
      );

      // Calcular o totalPrice
      let totalPrice = 0;
      const orderItemsData = items.map(({ productId, quantity }) => {
        const unitPrice = productMap.get(productId);
        if (unitPrice === undefined) {
          throw new ValidationError(`Product ${productId} not found.`);
        }

        const itemTotal = unitPrice * quantity;
        totalPrice += itemTotal;

        return {
          productId,
          quantity,
          unitPrice,
        };
      });

      // Criar a order
      const order = await tx.order.create({
        data: {
          customerId,
          totalPrice,
          status: "processed",
        },
      });

      // Criar os order_items
      await tx.order_item.createMany({
        data: orderItemsData.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      return order;
    });
  }

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
