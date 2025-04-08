import { Request, Response } from "express";
import { DashboardService } from "../services/dashboardService";

const dashboardService = new DashboardService();

export default class DashboardController {
  static async getSalesStats(req: Request, res: Response) {
    try {
      const { sellerId } = req.params;
      const stats = await dashboardService.getSalesStats(sellerId);
      return res.status(200).json(stats);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao obter estatísticas de vendas" });
    }
  }

  static async getBestSellingProducts(req: Request, res: Response) {
    try {
      const { sellerId } = req.params;
      const products = await dashboardService.getBestSellingProducts(sellerId);
      return res.status(200).json(products);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao obter produtos mais vendidos" });
    }
  }
}
