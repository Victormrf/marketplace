import { Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ReviewService } from "../services/reviewService";
import type {
  ReviewInput,
  ReviewPagination,
  ReviewReadFilters,
  ReviewUpdateInput,
} from "../types/review";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const reviewRoutes = Router();
const reviewService = new ReviewService();

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Invalid request body");
  }
  return body as Record<string, unknown>;
}

function reviewInput(body: unknown): ReviewInput {
  const data = parseBody(body);
  const allowed = new Set(["rating", "comment"]);
  const unknown = Object.keys(data).find((key) => !allowed.has(key));
  if (unknown) throw new ValidationError(`Unsupported review field: ${unknown}`);
  if (!("rating" in data)) throw new ValidationError("rating is required");
  return {
    rating: data.rating as number,
    comment: data.comment as string | null | undefined,
  };
}

function reviewUpdateInput(body: unknown): ReviewUpdateInput {
  const data = parseBody(body);
  const allowed = new Set(["rating", "comment"]);
  const unknown = Object.keys(data).find((key) => !allowed.has(key));
  if (unknown) throw new ValidationError(`Unsupported review field: ${unknown}`);
  if (!Object.keys(data).length) throw new ValidationError("Empty review update");
  return {
    ...(Object.prototype.hasOwnProperty.call(data, "rating")
      ? { rating: data.rating as number }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "comment")
      ? { comment: data.comment as string | null }
      : {}),
  };
}

function pagination(query: Record<string, unknown>): ReviewPagination {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new ValidationError("Invalid pagination");
  }
  return { page, limit };
}

function filters(query: Record<string, unknown>): ReviewReadFilters {
  if (query.rating === undefined) return {};
  const rating = Number(query.rating);
  if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError("Invalid rating filter");
  }
  return { rating };
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof ForbiddenError) {
    res.status(403).json({ error: error.message });
    return;
  }
  if (error instanceof ObjectNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Internal Server Error" });
}

reviewRoutes.post(
  "/products/:productId/reviews",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(201).json(
        await reviewService.createProductReview(
          req.user,
          req.params.productId,
          reviewInput(req.body),
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

reviewRoutes.get("/products/:productId/reviews", async (req, res) => {
  try {
    res.status(200).json(
      await reviewService.list(
        "product",
        req.params.productId,
        filters(req.query),
        pagination(req.query),
      ),
    );
  } catch (error) {
    handleError(error, res);
  }
});

reviewRoutes.post(
  "/sellers/:sellerId/reviews",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(201).json(
        await reviewService.createSellerReview(
          req.user,
          req.params.sellerId,
          reviewInput(req.body),
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

reviewRoutes.get("/sellers/:sellerId/reviews", async (req, res) => {
  try {
    res.status(200).json(
      await reviewService.list(
        "seller",
        req.params.sellerId,
        filters(req.query),
        pagination(req.query),
      ),
    );
  } catch (error) {
    handleError(error, res);
  }
});

reviewRoutes.get("/reviews/:reviewId", async (req, res) => {
  try {
    res.status(200).json(await reviewService.get(req.params.reviewId));
  } catch (error) {
    handleError(error, res);
  }
});

reviewRoutes.patch(
  "/reviews/:reviewId",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await reviewService.update(
          req.user,
          req.params.reviewId,
          reviewUpdateInput(req.body),
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);
