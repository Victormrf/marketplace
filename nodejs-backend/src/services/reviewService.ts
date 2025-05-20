import { Prisma } from "@prisma/client";
import { ReviewModel } from "../models/reviewModel";
import {
  ConflictError,
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export class ReviewService {
  async createProductReview(
    userId: string,
    reviewData: { productId: string; rating: number; comment?: string }
  ) {
    const { productId, rating, comment } = reviewData;
    if (!productId || rating === undefined) {
      throw new ValidationError("Missing required fields for product review.");
    }

    try {
      return await ReviewModel.create({
        userId,
        productId,
        rating,
        comment,
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          "This product has already received a review from you."
        );
      }
    }
  }

  async createSellerReview(
    userId: string,
    reviewData: { sellerId: string; rating: number; comment?: string }
  ) {
    const { sellerId, rating, comment } = reviewData;
    if (!sellerId || rating === undefined) {
      throw new ValidationError("Missing required fields for seller review.");
    }

    try {
      return await ReviewModel.create({
        userId,
        sellerId,
        rating,
        comment,
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          "This seller has already received a review from you."
        );
      }
    }
  }

  async getProductReviews(productId: string) {
    const data = await ReviewModel.getByProduct(productId);
    if (!data.reviews.length) {
      throw new ObjectsNotFoundError("reviews");
    }
    return data;
  }

  async getSellerReviews(sellerId: string) {
    return await ReviewModel.getBySeller(sellerId);
  }

  async updateReview(reviewId: string, rating?: number, comment?: string) {
    const updateData: { rating?: number; comment?: string } = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    return await ReviewModel.updateReview(reviewId, updateData);
  }

  async deleteReview(id: string) {
    const review = await ReviewModel.getById(id);
    if (!review) {
      throw new ObjectNotFoundError("review");
    }
    return await ReviewModel.deleteReview(id);
  }
}
