import { CartItemModel } from "../models/cartItemModel";

export class CartItemService {
  async addToCart(data: {
    userId: string;
    productId: string;
    quantity: number;
  }) {
    return CartItemModel.add(data);
  }

  async getUserCart(userId: string) {
    return CartItemModel.getByUser(userId);
  }

  async updateQuantity(id: string, quantity: number) {
    return CartItemModel.updateQuantity(id, quantity);
  }

  async removeFromCart(id: string) {
    return CartItemModel.delete(id);
  }

  async clearUserCart(userId: string) {
    return CartItemModel.clearCart(userId);
  }
}
