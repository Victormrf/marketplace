import { Router } from "express";
import { ProductService } from "../services/productService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import uploadProductImage from "../middlewares/uploadProductImage";

export const productRoutes = Router();
const productService = new ProductService();

productRoutes.post(
  "/",
  authMiddleware,
  uploadProductImage.single("image"),
  async (req, res) => {
    const { sellerId, name, description, price, stock, category } = req.body;

    // A imagem processada pelo Cloudinary já retorna a URL pública em req.file.path
    const imageUrl = (req.file as any)?.path || null;

    try {
      const newProductListing = await productService.createOrRestockProduct({
        sellerId,
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        image: imageUrl,
      });

      res.status(201).json(newProductListing);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Erro ao criar produto:", error.message);
        console.error("Stack:", error.stack);
      } else if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({
          message: "Erro interno ao criar produto",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
);

productRoutes.get("/:productIds", async (req, res) => {
  const { productIds } = req.params;
  const idsArray = productIds.split(",");
  try {
    const products = await productService.getProductsByIds(idsArray);
    res.status(200).json({ products });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    } else if (error instanceof ObjectsNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
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
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
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
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  }
});

productRoutes.put(
  "/:productId",
  authMiddleware,
  uploadProductImage.single("image"),
  async (req, res) => {
    const requestorRole = req.user.role;
    const { productId } = req.params;
    const updateData = req.body;

    if (requestorRole !== "ADMIN" && requestorRole !== "SELLER") {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    // Se imagem foi enviada, adiciona URL ao updateData
    if (req.file) {
      updateData.image = (req.file as any).path;
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
    }
  }
);

productRoutes.delete(
  "/:productId",
  authMiddleware,
  roleMiddleware("admin"),
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
