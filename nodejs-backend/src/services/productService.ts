import { Category, ProductModel } from "../models/productModel";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

interface ProductData {
  sellerId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: Category;
  image?: string;
}

export class ProductService {
  async createOrRestockProduct(productData: ProductData) {
    if (
      !productData.sellerId ||
      !productData.name ||
      productData.price === undefined ||
      productData.stock === undefined ||
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
    const product = await ProductModel.getById(productId);

    if (!product) {
      throw new ObjectNotFoundError("Product");
    }

    if (product.stock === undefined) {
      throw new ValidationError("Product stock is not initialized");
    }

    const newStock = product.stock + quantity;

    if (newStock < 0) {
      throw new ValidationError("Stock cannot be negative");
    }
    return await ProductModel.updateStock(productId, quantity);
  }

  async searchProducts(searchQuery: string) {
    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new ValidationError("Search query cannot be empty");
    }

    const products = await ProductModel.searchProducts(searchQuery.trim());

    if (!products.length) {
      throw new ObjectsNotFoundError("No products found matching your search");
    }

    return products;
  }

  async getProductById(productId: string) {
    const product = await ProductModel.getProductById(productId);

    if (!product) {
      throw new ObjectNotFoundError("product");
    }

    return product;
  }

  async getProductsByIds(productIds: string[]) {
    if (!productIds || !productIds.length) {
      throw new ValidationError("No product id was informed.");
    }

    const products = await ProductModel.getProductsByIds(productIds);

    if (!products || !products.length) {
      throw new ObjectsNotFoundError("products");
    }

    return products;
  }

  async getProductsBySellerId(sellerId: string) {
    return await ProductModel.getProductsBySeller(sellerId);
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
