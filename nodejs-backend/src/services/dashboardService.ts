import { OrderItemModel } from "../models/orderItemModel";
import { OrderModel } from "../models/orderModel";
import { ProductModel } from "../models/productModel";
import { ObjectsNotFoundError } from "../utils/customErrors";
import { format } from "date-fns";

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

  async getMonthlySalesStats(sellerId: string) {
    const orders = await OrderModel.getMonthlySalesBySeller(sellerId);

    if (!orders.length) {
      throw new ObjectsNotFoundError("Orders");
    }

    const monthlySalesMap: Record<string, number> = {};

    for (const order of orders) {
      const monthKey = format(order.createdAt, "yyyy-MM"); // Ex: "2025-05"
      if (!monthlySalesMap[monthKey]) {
        monthlySalesMap[monthKey] = 0;
      }
      monthlySalesMap[monthKey] += order.totalPrice || 0;
    }

    // Garante que todos os últimos 6 meses estejam no retorno, mesmo que com 0
    const result: { date: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(date, "yyyy-MM");
      result.push({
        date: key,
        revenue: monthlySalesMap[key] || 0,
      });
    }

    return result;
  }

  async getDailySalesStats(sellerId: string) {
    const orders = await OrderModel.getDailySalesBySeller(sellerId);

    if (!orders.length) {
      throw new ObjectsNotFoundError("Orders");
    }

    const dailySalesMap: Record<string, number> = {};

    for (const order of orders) {
      const dayKey = format(order.createdAt, "yyyy-MM-dd"); // Ex: "2025-05-05"
      if (!dailySalesMap[dayKey]) {
        dailySalesMap[dayKey] = 0;
      }
      dailySalesMap[dayKey] += order.totalPrice || 0;
    }

    // Garante que todos os últimos 6 meses estejam no retorno, mesmo que com 0
    const result: { date: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = format(date, "yyyy-MM-dd");
      result.push({
        date: key,
        revenue: dailySalesMap[key] || 0,
      });
    }

    return result;
  }

  async getOrdersBySeller(sellerId: string) {
    const orders = await OrderModel.getOrdersBySeller(sellerId);

    if (!orders.length) {
      throw new ObjectsNotFoundError("Orders");
    }

    return orders;
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
