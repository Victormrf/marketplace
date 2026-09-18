import { SellerOrderStatus, UserRole } from "@prisma/client";
import { dashboardRepository } from "../repositories/dashboardRepository";
import { reviewRepository } from "../repositories/reviewRepository";
import { sellerRepository } from "../repositories/sellerRepository";
import type { AuthenticatedUserDto } from "../types/auth";
import type {
  DashboardDateRange,
  DashboardRangeInput,
  DashboardRatingsDto,
  SellerDashboardOrderCollectionDto,
  SellerDashboardSummaryDto,
} from "../types/dashboard";
import { ForbiddenError, ValidationError } from "../utils/customErrors";

export class DashboardService {
  private async sellerIdFor(user: AuthenticatedUserDto): Promise<string> {
    if (user.role !== UserRole.SELLER) throw new ForbiddenError();
    const seller = await sellerRepository.findByUserId(user.id);
    if (!seller) throw new ForbiddenError();
    return seller.id;
  }

  private range(input: DashboardRangeInput = {}): DashboardDateRange {
    const to = input.to ?? new Date();
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const from = input.from ? new Date(input.from) : new Date(toExclusive);
    if (!input.from) from.setUTCDate(from.getUTCDate() - 30);
    if (Number.isNaN(from.getTime()) || Number.isNaN(toExclusive.getTime())) {
      throw new ValidationError("Invalid date range");
    }
    if (from >= toExclusive) throw new ValidationError("Invalid date range");
    if (toExclusive.getTime() - from.getTime() > 366 * 86400000) {
      throw new ValidationError("Dashboard date range is too large");
    }
    return { from, toExclusive };
  }

  private toOrderDto(record: {
    id: string;
    status: SellerOrderStatus;
    totalInCents: number;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    return {
      id: record.id,
      status: record.status,
      totalInCents: record.totalInCents,
      currency: "BRL" as const,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    };
  }

  async getSummary(
    user: AuthenticatedUserDto,
    input: DashboardRangeInput,
  ): Promise<SellerDashboardSummaryDto> {
    const sellerId = await this.sellerIdFor(user);
    const result = await dashboardRepository.summary(sellerId, this.range(input));
    return {
      currency: "BRL",
      grossRevenueInCents: result.grossRevenueInCents,
      deliveredSellerOrders: result.deliveredSellerOrders,
      itemsSold: result.itemsSold,
      averageTicketInCents:
        result.deliveredSellerOrders === 0
          ? 0
          : Math.round(
              result.grossRevenueInCents / result.deliveredSellerOrders,
            ),
    };
  }

  async getOrders(
    user: AuthenticatedUserDto,
    input: DashboardRangeInput,
    pagination: { page: number; limit: number },
    status?: SellerOrderStatus,
  ): Promise<SellerDashboardOrderCollectionDto> {
    const sellerId = await this.sellerIdFor(user);
    const range = this.range(input);
    const total = await dashboardRepository.countOrders(sellerId, range, status);
    const records = await dashboardRepository.findOrders(
      sellerId,
      range,
      (pagination.page - 1) * pagination.limit,
      pagination.limit,
      status,
    );
    return {
      data: records.map((record) => this.toOrderDto(record)),
      pagination: {
        ...pagination,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getOrdersByStatus(user: AuthenticatedUserDto, input: DashboardRangeInput) {
    const sellerId = await this.sellerIdFor(user);
    const counts = await dashboardRepository.countByStatus(sellerId, this.range(input));
    const byStatus = new Map(counts.map((item) => [item.status, item.count]));
    return Object.values(SellerOrderStatus).map((status) => ({
      status,
      count: byStatus.get(status) ?? 0,
    }));
  }

  async getTimeseries(
    user: AuthenticatedUserDto,
    input: DashboardRangeInput,
    interval: "day" | "month",
  ) {
    const sellerId = await this.sellerIdFor(user);
    return dashboardRepository.timeseries(sellerId, this.range(input), interval);
  }

  async getByCategory(user: AuthenticatedUserDto, input: DashboardRangeInput) {
    const sellerId = await this.sellerIdFor(user);
    return dashboardRepository.byCategory(sellerId, this.range(input));
  }

  async getTopProducts(
    user: AuthenticatedUserDto,
    input: DashboardRangeInput,
    limit: number,
  ) {
    const sellerId = await this.sellerIdFor(user);
    return dashboardRepository.topProducts(sellerId, this.range(input), limit);
  }

  async getNewCustomers(user: AuthenticatedUserDto, input: DashboardRangeInput) {
    const sellerId = await this.sellerIdFor(user);
    return dashboardRepository.newCustomers(sellerId, this.range(input));
  }

  async getRatings(user: AuthenticatedUserDto): Promise<DashboardRatingsDto> {
    const sellerId = await this.sellerIdFor(user);
    return reviewRepository.reputation("seller", sellerId);
  }
}
