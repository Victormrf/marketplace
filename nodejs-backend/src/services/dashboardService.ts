import { OrderItemModel } from "../models/orderItemModel";
import { OrderModel } from "../models/orderModel";
import { ProductModel } from "../models/productModel";
import { ObjectsNotFoundError } from "../utils/customErrors";

export class DashboardService {
  async getSalesStats(sellerId: string) {
    const orders = await OrderModel.getCompletedOrdersBySeller(sellerId);

    if (!orders.length) {
      throw new ObjectsNotFoundError("Orders");
    }

    const totalSales = orders.reduce(
      (sum, order) => sum + order.totalPrice!,
      0
    );
    const totalOrders = orders.length;

    return {
      totalSales,
      totalOrders,
    };
  }

  async getBestSellingProducts(sellerId: string) {
    const groupedData = await OrderItemModel.getBestSellingProductsBySeller(
      sellerId
    );

    if (!groupedData.length) {
      throw new ObjectsNotFoundError("Products");
    }

    const productIds = groupedData
      .map((item) => item.productId)
      .filter((id): id is string => typeof id === "string");

    const products = await ProductModel.getProductsByIds(productIds);

    const result = products.map((product) => {
      const quantityData = groupedData.find(
        (item) => item.productId === product.id
      );
      return {
        ...product,
        totalSold: quantityData?._sum?.quantity || 0,
      };
    });

    return result;
  }
}
