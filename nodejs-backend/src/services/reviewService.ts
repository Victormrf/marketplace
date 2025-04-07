import { ReviewModel } from "../models/reviewModel";
import {
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

    return await ReviewModel.create({
      userId,
      productId,
      rating,
      comment,
    });
  }

  async createSellerReview(
    userId: string,
    reviewData: { sellerId: string; rating: number; comment?: string }
  ) {
    const { sellerId, rating, comment } = reviewData;
    if (!sellerId || rating === undefined) {
      throw new ValidationError("Missing required fields for seller review.");
    }

    return await ReviewModel.create({
      userId,
      sellerId,
      rating,
      comment,
    });
  }

  async getProductReviews(productId: string) {
    const reviews = await ReviewModel.getByProduct(productId);
    if (!reviews.length) {
      throw new ObjectsNotFoundError("reviews");
    }
    return reviews;
  }

  async getSellerReviews(sellerId: string) {
    const reviews = await ReviewModel.getBySeller(sellerId);
    if (!reviews.length) {
      throw new ObjectsNotFoundError("reviews");
    }
    return reviews;
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
