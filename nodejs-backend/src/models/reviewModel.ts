import prisma from "../config/db";
import {
  removeNullFields,
  removeNullFieldsFromArray,
} from "../utils/removeNullFields";

export class ReviewModel {
  static async create(data: {
    userId: string;
    productId?: string;
    sellerId?: string;
    rating: number;
    comment?: string;
  }) {
    const review = await prisma.review.create({ data });
    return removeNullFields(review);
  }

  static async getById(reviewId: string) {
    return prisma.review.findUnique({ where: { id: reviewId } });
  }

  static async getByProduct(productId: string) {
    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });

    const filteredReviews = removeNullFieldsFromArray(reviews);

    const averageRating =
      filteredReviews.reduce((acc: number, curr: any) => acc + curr.rating, 0) /
        filteredReviews.length || 0;

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      reviews: filteredReviews,
    };
  }

  static async getBySeller(sellerId: string) {
    const reviews = await prisma.review.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });

    const filteredReviews = removeNullFieldsFromArray(reviews);

    const averageRating =
      filteredReviews.reduce((acc: number, curr: any) => acc + curr.rating, 0) /
        filteredReviews.length || 0;

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      reviews: filteredReviews,
    };
  }

  static async getRatingDistributionBySeller(sellerId: string) {
    const result = await prisma.review.groupBy({
      by: ["rating"],
      where: {
        product: {
          sellerId: sellerId, // passado como parâmetro
        },
      },
      _count: {
        rating: true,
      },
    });

    return [1, 2, 3, 4, 5].map((rating) => {
      const found = result.find(
        (r: { rating: number; _count: { rating: number } }) =>
          r.rating === rating
      );
      return {
        rating,
        count: found ? found._count.rating : 0,
      };
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
