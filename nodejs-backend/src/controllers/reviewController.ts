import { Router } from "express";
import { ReviewService } from "../services/reviewService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ValidationError,
  ObjectNotFoundError,
  ConflictError,
} from "../utils/customErrors";

export const reviewRoutes = Router();
const reviewService = new ReviewService();

reviewRoutes.post("/product", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const requestorRole = req.user.role;
  const { productId, rating, comment } = req.body;

  if (requestorRole !== "CUSTOMER") {
    res.status(403).json({ error: "Only customers can send reviews." });
    return;
  }

  try {
    const review = await reviewService.createProductReview(userId, {
      productId,
      rating,
      comment,
    });
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

// Criar avaliação de um vendedor
reviewRoutes.post("/seller", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const requestorRole = req.user.role;
  const { sellerId, rating, comment } = req.body;

  if (requestorRole !== "CUSTOMER") {
    res.status(403).json({ error: "Only customers can send reviews." });
    return;
  }

  try {
    const review = await reviewService.createSellerReview(userId, {
      sellerId,
      rating,
      comment,
    });
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

reviewRoutes.get("/product/:productId", async (req, res) => {
  try {
    const reviews = await reviewService.getProductReviews(req.params.productId);
    res.status(200).json(reviews);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

reviewRoutes.get("/seller/:sellerId", async (req, res) => {
  try {
    const reviews = await reviewService.getSellerReviews(req.params.sellerId);
    res.status(200).json(reviews);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

reviewRoutes.put("/:reviewId", authMiddleware, async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  try {
    const updated = await reviewService.updateReview(reviewId, rating, comment);
    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

reviewRoutes.delete("/:reviewId", authMiddleware, async (req, res) => {
  try {
    await reviewService.deleteReview(req.params.reviewId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});
