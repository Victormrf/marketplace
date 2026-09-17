import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import type { ReviewReadFilters } from "../types/review";

const reviewSelect = {
  id: true,
  userId: true,
  productId: true,
  sellerId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect;

export type ReviewRecord = Prisma.ReviewGetPayload<{
  select: typeof reviewSelect;
}>;

function targetWhere(
  target: "product" | "seller",
  targetId: string,
  filters: ReviewReadFilters,
): Prisma.ReviewWhereInput {
  return {
    [target === "product" ? "productId" : "sellerId"]: targetId,
    ...(filters.rating ? { rating: filters.rating } : {}),
  };
}

export class ReviewRepository {
  async findById(id: string): Promise<ReviewRecord | null> {
    return prisma.review.findUnique({ where: { id }, select: reviewSelect });
  }

  async findByIdForAuthor(
    id: string,
    userId: string,
  ): Promise<ReviewRecord | null> {
    return prisma.review.findFirst({
      where: { id, userId },
      select: reviewSelect,
    });
  }

  async productExists(productId: string): Promise<boolean> {
    return Boolean(
      await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }),
    );
  }

  async sellerExists(sellerId: string): Promise<boolean> {
    return Boolean(
      await prisma.seller.findUnique({
        where: { id: sellerId },
        select: { id: true },
      }),
    );
  }

  async hasDeliveredProductPurchase(
    customerId: string,
    productId: string,
  ): Promise<boolean> {
    return Boolean(
      await prisma.orderItem.findFirst({
        where: {
          productId,
          sellerOrder: {
            status: "DELIVERED",
            order: { customerId },
          },
        },
        select: { id: true },
      }),
    );
  }

  async hasDeliveredSellerPurchase(
    customerId: string,
    sellerId: string,
  ): Promise<boolean> {
    return Boolean(
      await prisma.sellerOrder.findFirst({
        where: {
          sellerId,
          status: "DELIVERED",
          order: { customerId },
        },
        select: { id: true },
      }),
    );
  }

  async create(data: {
    userId: string;
    productId?: string;
    sellerId?: string;
    rating: number;
    comment: string | null;
  }): Promise<ReviewRecord> {
    return prisma.review.create({ data, select: reviewSelect });
  }

  async update(
    id: string,
    userId: string,
    data: { rating?: number; comment?: string | null },
  ): Promise<ReviewRecord | null> {
    const result = await prisma.review.updateMany({
      where: { id, userId },
      data,
    });
    if (result.count !== 1) return null;
    return this.findByIdForAuthor(id, userId);
  }

  async count(
    target: "product" | "seller",
    targetId: string,
    filters: ReviewReadFilters,
  ): Promise<number> {
    return prisma.review.count({ where: targetWhere(target, targetId, filters) });
  }

  async findMany(
    target: "product" | "seller",
    targetId: string,
    filters: ReviewReadFilters,
    skip: number,
    take: number,
  ): Promise<ReviewRecord[]> {
    return prisma.review.findMany({
      where: targetWhere(target, targetId, filters),
      select: reviewSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }

  async reputation(
    target: "product" | "seller",
    targetId: string,
  ): Promise<{
    averageRating: number | null;
    totalReviews: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  }> {
    const rows = await prisma.review.groupBy({
      by: ["rating"],
      where: targetWhere(target, targetId, {}),
      _count: { rating: true },
    });
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
      1 | 2 | 3 | 4 | 5,
      number
    >;
    for (const row of rows) {
      if (row.rating >= 1 && row.rating <= 5) {
        distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
      }
    }
    const totalReviews = Object.values(distribution).reduce(
      (total, count) => total + count,
      0,
    );
    const ratingSum = Object.entries(distribution).reduce(
      (total, [rating, count]) => total + Number(rating) * count,
      0,
    );
    return {
      averageRating:
        totalReviews === 0
          ? null
          : Number((ratingSum / totalReviews).toFixed(2)),
      totalReviews,
      distribution,
    };
  }

  async ratingDistributionBySeller(
    sellerId: string,
  ): Promise<Array<{ rating: number; count: number }>> {
    const reputation = await this.reputation("seller", sellerId);
    return [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: reputation.distribution[rating as 1 | 2 | 3 | 4 | 5],
    }));
  }
}

export const reviewRepository = new ReviewRepository();
