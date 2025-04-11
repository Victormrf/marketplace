import { Router } from "express";
import { ProductService } from "../services/productService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { adminMiddleware } from "../middlewares/isAdminMiddleware";

export const productRoutes = Router();
const productService = new ProductService();

productRoutes.post("/listProduct", authMiddleware, async (req, res) => {
  const { sellerId, name, description, price, stock, category } = req.body;

  try {
    const newProductListing = await productService.createOrRestockProduct({
      sellerId,
      name,
      description,
      price,
      stock,
      category,
    });
    res.status(201).json(newProductListing);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ error: error });
      return;
    }
  }
});

productRoutes.get("/seller/:sellerId", async (req, res) => {
  const { sellerId } = req.params;

  try {
    const products = await productService.getProductsBySellerId(sellerId);
    res.status(200).json({ products });
  } catch (error) {
    if (error instanceof ObjectsNotFoundError) {
      res.status(400).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ error: error });
      return;
    }
  }
});

productRoutes.get("/category/:category", async (req, res) => {
  const { category } = req.params;

  try {
    const products = await productService.getProductsByCategory(category);
    res.status(200).json({ products });
  } catch (error) {
    if (error instanceof ObjectsNotFoundError) {
      res.status(400).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ error: error });
      return;
    }
  }
});

productRoutes.put("/:productId", authMiddleware, async (req, res) => {
  const requestorRole = req.user.role;
  const { productId } = req.params;
  const updateData = req.body;

  if (requestorRole !== "admin" && requestorRole !== "seller") {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const updatedProduct = await productService.updateProduct(
      productId,
      updateData
    );
    res.status(200).json(updatedProduct);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

productRoutes.delete(
  "/:productId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { productId } = req.params;

    try {
      await productService.deleteProduct(productId);
      res.status(204).json({ message: "Product was successfully deleted" });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error });
      return;
    }
  }
);
