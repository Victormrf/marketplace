import { ProductModel } from "../models/productModel";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

interface ProductData {
  sellerId: string;
  name: string;
  description?: string;
  price: Float32Array;
  stock: number;
  category: string;
}

export class ProductService {
  async createOrRestockProduct(productData: ProductData) {
    if (
      !productData.sellerId ||
      !productData.name ||
      !productData.price ||
      !productData.stock ||
      !productData.category
    ) {
      throw new ValidationError("Missing required fields");
    }

    const existingProduct = await ProductModel.getProductBySellerAndName(
      productData.name,
      productData.sellerId
    );

    if (existingProduct && existingProduct.id) {
      return await this.restock(existingProduct.id, productData.stock);
    }

    return await ProductModel.create(productData);
  }

  async restock(productId: string, quantity: number) {
    return await ProductModel.updateStock(productId, quantity);
  }

  async getProductsBySellerId(sellerId: string) {
    const products = await ProductModel.getProductsBySeller(sellerId);

    if (!products.length) {
      throw new ObjectsNotFoundError("Products");
    }

    return products;
  }

  async getProductsByCategory(category: string) {
    const products = await ProductModel.getProductsByCategory(category);

    if (!products.length) {
      throw new ObjectsNotFoundError("Products");
    }

    return products;
  }

  async updateProduct(productId: string, productData: Partial<ProductData>) {
    const product = await ProductModel.getById(productId);

    if (!product) {
      throw new ObjectNotFoundError("Product");
    }

    try {
      return await ProductModel.update(productId, productData);
    } catch (error: any) {
      throw new Error(`Failed to update product: ${(error as Error).message}`);
    }
  }

  async deleteProduct(productId: string) {
    const product = await ProductModel.getById(productId);

    if (!product) {
      throw new ObjectNotFoundError("Product");
    }

    return await ProductModel.delete(productId);
  }
}
