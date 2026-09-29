import { browserRequest } from "@/lib/http";
import type {
  ReviewCollectionDto,
  ReviewDto,
  ReviewFilters,
  ReviewInput,
  ReviewUpdateInput,
} from "@/types/reviews";

function queryString(filters: ReviewFilters = {}) {
  const query = new URLSearchParams();
  if (filters.page !== undefined) query.set("page", String(filters.page));
  if (filters.limit !== undefined) query.set("limit", String(filters.limit));
  if (filters.rating !== undefined) query.set("rating", String(filters.rating));
  return query.toString();
}

export function listProductReviews(productId: string, filters: ReviewFilters = {}) {
  const query = queryString(filters);
  const path = `/api/products/${encodeURIComponent(productId)}/reviews`;
  return browserRequest<ReviewCollectionDto>(query ? `${path}?${query}` : path);
}

export function listSellerReviews(sellerId: string, filters: ReviewFilters = {}) {
  const query = queryString(filters);
  const path = `/api/sellers/${encodeURIComponent(sellerId)}/reviews`;
  return browserRequest<ReviewCollectionDto>(query ? `${path}?${query}` : path);
}

export function getReview(reviewId: string) {
  return browserRequest<ReviewDto>(`/api/reviews/${encodeURIComponent(reviewId)}`);
}

export function createProductReview(productId: string, input: ReviewInput) {
  return browserRequest<ReviewDto>(
    `/api/products/${encodeURIComponent(productId)}/reviews`,
    { method: "POST", json: input },
  );
}

export function createSellerReview(sellerId: string, input: ReviewInput) {
  return browserRequest<ReviewDto>(
    `/api/sellers/${encodeURIComponent(sellerId)}/reviews`,
    { method: "POST", json: input },
  );
}

export function updateReview(reviewId: string, input: ReviewUpdateInput) {
  return browserRequest<ReviewDto>(
    `/api/reviews/${encodeURIComponent(reviewId)}`,
    { method: "PATCH", json: input },
  );
}
