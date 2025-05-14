import { OrderItem, OrderItemModel } from "../models/orderItemModel";
import { OrderModel } from "../models/orderModel";
import { ProductModel } from "../models/productModel";
import { ReviewModel } from "../models/reviewModel";
import { ObjectsNotFoundError } from "../utils/customErrors";
import { format } from "date-fns";

export class DashboardService {
  async getSalesStats(sellerId: string) {
    const items = await OrderModel.getCompletedOrderItemsBySeller(sellerId);

    if (!items.length) {
      throw new ObjectsNotFoundError("OrderItems");
    }

    const totalSales = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );

    const totalItemsSold = items.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0
    );

    return {
      totalSales,
      totalItemsSold,
    };
  }

  async getOrdersCountByStatus(sellerId: string) {
    const orders = await OrderModel.getOrdersByStatus(sellerId);

    if (!orders.length) {
      throw new ObjectsNotFoundError("Orders");
    }

    const statusTotals: Record<string, number> = {};

    for (const order of orders) {
      const status = order.status;

      if (status) {
        statusTotals[status] = (statusTotals[status] || 0) + 1;
      }
    }

    return Object.entries(statusTotals).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
      count,
    }));
  }

  async getSalesCountByCategory(sellerId: string) {
    const orderItems = await OrderModel.getCompletedOrderItemsByCategory(
      sellerId
    );

    if (!orderItems.length) {
      throw new ObjectsNotFoundError("Order Items");
    }

    const categoryTotals: Record<string, number> = {};

    for (const item of orderItems) {
      const category = item.product.category;
      const totalItemValue = item.quantity * item.unitPrice;
      if (category) {
        categoryTotals[category] =
          (categoryTotals[category] || 0) + totalItemValue;
      }
    }

    return Object.entries(categoryTotals).map(([category, totalSales]) => ({
      category,
      totalSales,
    }));
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

  async getNewCustomersPerMonth(sellerId: string) {
    const newCustomersData = await OrderModel.getNewCustomersByMonth(sellerId);

    if (!newCustomersData.length) {
      throw new ObjectsNotFoundError("New customers");
    }

    return newCustomersData;
  }

  async getRatingDistributionOfSeller(sellerId: string) {
    const distribution = await ReviewModel.getRatingDistributionBySeller(
      sellerId
    );

    if (!distribution.length) {
      throw new ObjectsNotFoundError("Reviews");
    }

    return distribution;
  }
}
