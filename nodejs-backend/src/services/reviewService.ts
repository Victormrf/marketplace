import { UserRole } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { customerRepository } from "../repositories/customerRepository";
import {
  ReviewRepository,
  reviewRepository,
  type ReviewRecord,
} from "../repositories/reviewRepository";
import type { AuthenticatedUserDto } from "../types/auth";
import type {
  ReviewCollectionDto,
  ReviewDto,
  ReviewInput,
  ReviewPagination,
  ReviewReadFilters,
  ReviewTarget,
  ReviewUpdateInput,
} from "../types/review";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

const MAX_COMMENT_LENGTH = 2000;

function toDto(record: ReviewRecord): ReviewDto {
  return {
    id: record.id,
    productId: record.productId,
    sellerId: record.sellerId,
    rating: record.rating,
    comment: record.comment,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeInput(
  input: ReviewInput | ReviewUpdateInput,
  requireRating = true,
): ReviewInput | ReviewUpdateInput {
  if (input.rating === undefined) {
    if (requireRating) {
      throw new ValidationError("rating is required");
    }
  } else if (
    !Number.isSafeInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    throw new ValidationError("rating must be an integer between 1 and 5");
  }
  if (!Object.prototype.hasOwnProperty.call(input, "comment")) {
    return input;
  }
  if (input.comment === null) {
    return { ...input, comment: null };
  }
  if (typeof input.comment !== "string") {
    throw new ValidationError("comment must be a string");
  }
  const comment = input.comment.trim();
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError("comment is too long");
  }
  return { ...input, comment: comment || null };
}

function duplicateReviewError(target: ReviewTarget): ConflictError {
  return new ConflictError(
    target === "product"
      ? "This product has already received a review from you."
      : "This seller has already received a review from you.",
  );
}

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository = reviewRepository,
  ) {}

  private async requireCustomer(user: AuthenticatedUserDto): Promise<string> {
    if (user.role !== UserRole.CUSTOMER) throw new ForbiddenError();
    const customer = await customerRepository.findByUserId(user.id);
    if (!customer) throw new ForbiddenError();
    return customer.id;
  }

  private async create(
    user: AuthenticatedUserDto,
    target: ReviewTarget,
    targetId: string,
    input: ReviewInput,
  ): Promise<ReviewDto> {
    const customerId = await this.requireCustomer(user);
    const normalized = normalizeInput(input);
    const exists =
      target === "product"
        ? await this.repository.productExists(targetId)
        : await this.repository.sellerExists(targetId);
    if (!exists) {
      throw new ObjectNotFoundError(target === "product" ? "Product" : "Seller");
    }

    const purchased =
      target === "product"
        ? await this.repository.hasDeliveredProductPurchase(customerId, targetId)
        : await this.repository.hasDeliveredSellerPurchase(customerId, targetId);
    if (!purchased) {
      throw new ForbiddenError("A delivered purchase is required");
    }

    try {
      const record = await this.repository.create({
        userId: user.id,
        ...(target === "product"
          ? { productId: targetId }
          : { sellerId: targetId }),
        rating: normalized.rating as number,
        comment: normalized.comment ?? null,
      });
      return toDto(record);
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw duplicateReviewError(target);
      }
      throw error;
    }
  }

  async createProductReview(
    user: AuthenticatedUserDto,
    productId: string,
    input: ReviewInput,
  ): Promise<ReviewDto> {
    return this.create(user, "product", productId, input);
  }

  async createSellerReview(
    user: AuthenticatedUserDto,
    sellerId: string,
    input: ReviewInput,
  ): Promise<ReviewDto> {
    return this.create(user, "seller", sellerId, input);
  }

  async list(
    target: ReviewTarget,
    targetId: string,
    filters: ReviewReadFilters,
    pagination: ReviewPagination,
  ): Promise<ReviewCollectionDto> {
    const total = await this.repository.count(target, targetId, filters);
    const records = await this.repository.findMany(
      target,
      targetId,
      filters,
      (pagination.page - 1) * pagination.limit,
      pagination.limit,
    );
    const reputation = await this.repository.reputation(target, targetId);
    return {
      data: records.map(toDto),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
      reputation,
    };
  }

  async get(reviewId: string): Promise<ReviewDto> {
    const record = await this.repository.findById(reviewId);
    if (!record) throw new ObjectNotFoundError("Review");
    return toDto(record);
  }

  async update(
    user: AuthenticatedUserDto,
    reviewId: string,
    input: ReviewUpdateInput,
  ): Promise<ReviewDto> {
    const existing = await this.repository.findById(reviewId);
    if (!existing) throw new ObjectNotFoundError("Review");
    if (existing.userId !== user.id) throw new ForbiddenError();
    const normalized = normalizeInput(input, false);
    const updated = await this.repository.update(reviewId, user.id, {
      ...(normalized.rating === undefined
        ? {}
        : { rating: normalized.rating }),
      ...(normalized.comment === undefined
        ? {}
        : { comment: normalized.comment }),
    });
    if (!updated) throw new ObjectNotFoundError("Review");
    return toDto(updated);
  }
}
