import { CustomerModel } from "../models/customerModel";
import { SellerModel } from "../models/sellerModel";
import { ExistingProfileError } from "../utils/customErrors";

interface CustomerData {
  address: string;
  phone: string;
}

export class CustomerService {
  async createCustomerProfile(userId: string, customerData: CustomerData) {
    const existingProfile =
      (await CustomerModel.getByUserId(userId)) ||
      (await SellerModel.getByUserId(userId));

    if (existingProfile) {
      throw new ExistingProfileError();
    }

    try {
      return await CustomerModel.create({ userId, ...customerData });
    } catch (error) {
      throw error;
    }
  }
}
