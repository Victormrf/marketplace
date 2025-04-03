import { ProductModel } from "../models/productModel";

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
    const existingProduct = await ProductModel.getProductBySellerAndName(
      productData.name,
      productData.sellerId
    );

    if (existingProduct && existingProduct.id) {
      return await this.restock(existingProduct.id, productData.stock);
    }
  }

  async restock(productId: string, quantity: number) {
    return await ProductModel.updateStock(productId, quantity);
  }
}
