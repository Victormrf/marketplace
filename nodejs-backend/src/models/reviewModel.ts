import prisma from "../config/db";

export class ReviewModel {
  static async create(data: {
    userId: string;
    productId?: string;
    sellerId?: string;
    rating: number;
    comment?: string;
  }) {
    return prisma.review.create({ data });
  }

  static async getById(reviewId: string) {
    return prisma.review.findUnique({ where: { id: reviewId } });
  }

  static async getByProduct(productId: string) {
    return prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getBySeller(sellerId: string) {
    return prisma.review.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async updateReview(
    reviewId: string,
    data: { rating?: number; comment?: string }
  ): Promise<void> {
    return prisma.review.update({
      where: { id: reviewId },
      data,
    });
  }

  static async deleteReview(reviewId: string) {
    return prisma.review.delete({ where: { id: reviewId } });
  }
}
