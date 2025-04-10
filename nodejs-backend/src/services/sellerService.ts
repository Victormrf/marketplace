import { CustomerModel } from "../models/customerModel";
import { SellerModel } from "../models/sellerModel";
import {
  ObjectNotFoundError,
  ExistingProfileError,
  ValidationError,
} from "../utils/customErrors";

interface SellerData {
  storeName: string;
  description: string;
}

export class SellerService {
  async createSellerProfile(userId: string, sellerData: SellerData) {
    if (!sellerData.storeName || !sellerData.description) {
      throw new ValidationError("Missing required fields");
    }

    const existingCustomer = await CustomerModel.getByUserId(userId);
    const existingSeller = await SellerModel.getByUserId(userId);

    if (existingCustomer || existingSeller) {
      throw new ExistingProfileError();
    }

    return await SellerModel.create({ userId, ...sellerData });
  }

  async getAllSellers() {
    return await SellerModel.getAllSellers();
  }

  async getSellerProfile(userId: string) {
    const seller = await SellerModel.getByUserId(userId);

    if (!seller) {
      throw new ObjectNotFoundError("Seller");
    }

    return seller;
  }

  async updateSellerProfile(userId: string, data: Partial<SellerData>) {
    const seller = await SellerModel.getByUserId(userId);

    if (!seller) {
      throw new ObjectNotFoundError("Seller");
    }

    try {
      return await SellerModel.updateSeller(userId, data);
    } catch (error: any) {
      throw new Error(`Failed to update seller: ${(error as Error).message}`);
    }
  }

  async deleteSellerProfile(userId: string): Promise<void> {
    const seller = await SellerModel.getByUserId(userId);

    if (!seller) {
      throw new ObjectNotFoundError("Seller");
    }

    try {
      return await SellerModel.deleteSeller(userId);
    } catch (error: any) {
      throw new Error(`Failed to delete seller: ${(error as Error).message}`);
    }
  }
}
