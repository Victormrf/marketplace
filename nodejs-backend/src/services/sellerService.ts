import { CustomerModel } from "../models/customerModel";
import { SellerModel } from "../models/sellerModel";
import { ExistingProfileError } from "../utils/customErrors";

interface SellerData {
  storeName: string;
  description: string;
}

export class SellerService {
  async createSellerProfile(userId: string, sellerData: SellerData) {
    const existingCustomer = await CustomerModel.getByUserId(userId);
    const existingSeller = await SellerModel.getByUserId(userId);

    if (existingCustomer || existingSeller) {
      throw new ExistingProfileError();
    }

    return await SellerModel.create({ userId, ...sellerData });
  }
}
