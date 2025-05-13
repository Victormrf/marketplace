import { Router } from "express";
import { DashboardService } from "../services/dashboardService";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ObjectsNotFoundError } from "../utils/customErrors";

const dashboardService = new DashboardService();

export const dashboardRoutes = Router();

dashboardRoutes.get(
  "/sellers/salesStats/:sellerId",
  authMiddleware,
  async (req, res) => {
    const { sellerId } = req.params;
    try {
      const stats = await dashboardService.getSalesStats(sellerId);
      res.status(200).json(stats);
    } catch (error) {
      if (error instanceof ObjectsNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);

dashboardRoutes.get(
  "/sellers/salesByCategory/:sellerId",
  authMiddleware,
  async (req, res) => {
    const { sellerId } = req.params;
    try {
      const data = await dashboardService.getSalesCountByCategory(sellerId);
      res.status(200).json(data);
    } catch (error) {
      if (error instanceof ObjectsNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

dashboardRoutes.get(
  "/sellers/orders/:sellerId",
  authMiddleware,
  async (req, res) => {
    const { sellerId } = req.params;
    try {
      const stats = await dashboardService.getOrdersBySeller(sellerId);
      res.status(200).json(stats);
    } catch (error) {
      if (error instanceof ObjectsNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);

dashboardRoutes.get(
  "/sellers/lastSixMonthsSalesStats/:sellerId",
  authMiddleware,
  async (req, res) => {
    const { sellerId } = req.params;
    try {
      const stats = await dashboardService.getMonthlySalesStats(sellerId);
      res.status(200).json(stats);
    } catch (error) {
      if (error instanceof ObjectsNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);

dashboardRoutes.get(
  "/sellers/lastThirtyDaysSalesStats/:sellerId",
  authMiddleware,
  async (req, res) => {
    const { sellerId } = req.params;
    try {
      const stats = await dashboardService.getDailySalesStats(sellerId);
      res.status(200).json(stats);
    } catch (error) {
      if (error instanceof ObjectsNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);

dashboardRoutes.get(
  "/sellers/bestSellingProducts/:sellerId",
  authMiddleware,
  async (req, res) => {
    const { sellerId } = req.params;
    try {
      const products = await dashboardService.getBestSellingProducts(sellerId);
      res.status(200).json(products);
    } catch (error) {
      if (error instanceof ObjectsNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);
