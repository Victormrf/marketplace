import { OrderItemModel } from "../models/orderItemModel";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

interface OrderItemData {
  orderId: string;
  productId: string;
  quantity: number;
}

export class OrderItemService {
  async addItemToOrder(itemData: OrderItemData) {
    if (!itemData.orderId || !itemData.productId || !itemData.quantity) {
      throw new ValidationError("Missing required fields.");
    }

    return await OrderItemModel.create(itemData);
  }

  async updateItemQuantity(itemId: string, quantity: number) {
    const item = await OrderItemModel.getById(itemId);

    if (!item) {
      throw new ObjectNotFoundError("Order item");
    }

    return await OrderItemModel.updateQuantity(itemId, quantity);
  }

  async removeItemFromOrder(itemId: string) {
    const item = await OrderItemModel.getById(itemId);

    if (!item) {
      throw new ObjectNotFoundError("Order item");
    }

    return await OrderItemModel.delete(itemId);
  }

  async getItemsByOrderId(orderId: string) {
    const items = await OrderItemModel.getByOrderId(orderId);

    if (!items.length) {
      throw new ObjectNotFoundError("Order items");
    }

    return items;
  }
}
