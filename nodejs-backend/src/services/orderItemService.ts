import prisma from "../config/db";
import { OrderItemModel } from "../models/orderItemModel";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export class OrderItemService {
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

    // Executa a lógica dentro de uma transação
    return await prisma.$transaction(async (tx: any) => {
      const { orderId, productId, quantity } = item;

      if (quantity === undefined) {
        throw new ValidationError("Order item has no quantity");
      }

      // Busca o preço do produto
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new ObjectNotFoundError("Product");
      }

      const itemTotal = product.price * quantity;

      // Atualiza o total da ordem
      await tx.order.update({
        where: { id: orderId },
        data: {
          totalPrice: {
            decrement: itemTotal,
          },
        },
      });

      // Deleta o item do pedido
      await tx.order_item.delete({
        where: { id: itemId },
      });
    });
  }

  async getItemsByOrderId(orderId: string) {
    const items = await OrderItemModel.getByOrderId(orderId);

    if (!items.length) {
      throw new ObjectNotFoundError("Order items");
    }

    return items;
  }
}
