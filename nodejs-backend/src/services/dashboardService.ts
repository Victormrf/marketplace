import { OrderRepository } from "../repositories/orderRepository";
import { productRepository } from "../repositories/productRepository";
import { ReviewModel } from "../models/reviewModel";
import { format } from "date-fns";

export class DashboardService {
  private readonly orderRepository = new OrderRepository();
  async getSalesStats(sellerId: string) {
    const items =
      await this.orderRepository.getCompletedOrderItemsBySeller(sellerId);

    const totalSales = items.reduce(
      (sum: number, item: { quantity: number; unitPriceInCents: number }) =>
        sum + item.quantity * item.unitPriceInCents,
      0,
    );

    const totalItemsSold = items.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0,
    );

    return {
      totalSales,
      totalItemsSold,
    };
  }

  async getOrdersCountByStatus(sellerId: string) {
    const orders = await this.orderRepository.getOrdersByStatus(sellerId);

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
    const orderItems =
      await this.orderRepository.getCompletedOrderItemsByCategory(sellerId);

    const categoryTotals: Record<string, number> = {};

    for (const item of orderItems) {
      const category = item.product.category;
      const totalItemValue = item.quantity * item.unitPriceInCents;
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
    const orders = await this.orderRepository.getMonthlySalesBySeller(sellerId);

    const monthlySalesMap: Record<string, number> = {};

    for (const order of orders) {
      const monthKey = format(order.createdAt, "yyyy-MM"); // Ex: "2025-05"
      if (!monthlySalesMap[monthKey]) {
        monthlySalesMap[monthKey] = 0;
      }
      monthlySalesMap[monthKey] += order.totalInCents || 0;
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
    const orders = await this.orderRepository.getDailySalesBySeller(sellerId);

    const dailySalesMap: Record<string, number> = {};

    for (const order of orders) {
      const dayKey = format(order.createdAt, "yyyy-MM-dd"); // Ex: "2025-05-05"
      if (!dailySalesMap[dayKey]) {
        dailySalesMap[dayKey] = 0;
      }
      dailySalesMap[dayKey] += order.totalInCents || 0;
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
    return await this.orderRepository.getOrdersBySeller(sellerId);
  }

  async getBestSellingProducts(sellerId: string) {
    const groupedData =
      await this.orderRepository.getBestSellingProductsBySeller(sellerId);

    const productIds = groupedData
      .map((item: { productId: string }) => item.productId)
      .filter((id: string): id is string => typeof id === "string");

    const products = await productRepository.getProductsByIds(productIds);

    const result = products.map((product) => {
      const quantityData = groupedData.find(
        (item: { productId: string }) => item.productId === product.id,
      );
      return {
        ...product,
        totalSold: quantityData?._sum?.quantity || 0,
      };
    });

    return result;
  }

  async getNewCustomersPerMonth(sellerId: string) {
    return await this.orderRepository.getNewCustomersByMonth(sellerId);
  }

  async getRatingDistributionOfSeller(sellerId: string) {
    return await ReviewModel.getRatingDistributionBySeller(sellerId);
  }
}
