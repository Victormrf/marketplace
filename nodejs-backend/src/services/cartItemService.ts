import { CartItemModel } from "../models/cartItemModel";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

interface CartItemData {
  userId: string;
  productId: string;
  quantity: number;
}

export class CartItemService {
  async addToCart(cartItemData: CartItemData) {
    if (
      !cartItemData.userId ||
      !cartItemData.productId ||
      !cartItemData.quantity
    ) {
      throw new ValidationError("Missing required fields");
    }
    return CartItemModel.add(cartItemData);
  }

  async getUserCart(userId: string) {
    const userCart = await CartItemModel.getByUser(userId);

    if (!userCart) {
      throw new ObjectNotFoundError("User cart");
    }

    return userCart;
  }

  async updateQuantity(productId: string, quantity: number) {
    const cartItem = await CartItemModel.getByProductId(productId);

    if (!cartItem) {
      throw new ObjectNotFoundError("Cart item");
    }

    return CartItemModel.updateQuantity(cartItem.id, quantity);
  }

  async removeFromCart(id: string) {
    const cartItem = await CartItemModel.getById(id);

    if (!cartItem) {
      throw new ObjectNotFoundError("Cart item");
    }

    return CartItemModel.delete(id);
  }

  async removeProductFromCart(productId: string) {
    const cartItem = await CartItemModel.getByProductId(productId);

    if (!cartItem) {
      throw new ObjectNotFoundError("Cart item");
    }

    return CartItemModel.delete(cartItem.id);
  }

  async clearUserCart(userId: string) {
    const userCart = await CartItemModel.getByUser(userId);

    if (!userCart) {
      throw new ObjectNotFoundError("User cart");
    }

    return CartItemModel.clearCart(userId);
  }
}
