import { CustomerModel } from "../models/customerModel";
import { SellerModel } from "../models/sellerModel";
import { ExistingProfileError } from "../utils/customErrors";

interface CustomerData {
  address: string;
  phone: string;
}

export class CustomerService {
  async createCustomerProfile(userId: string, customerData: CustomerData) {
    const existingCustomer = await CustomerModel.getByUserId(userId);
    const existingSeller = await SellerModel.getByUserId(userId);

    if (existingCustomer || existingSeller) {
      throw new ExistingProfileError();
    }

    return await CustomerModel.create({ userId, ...customerData });
  }

  async getAllCustomers() {
    return await CustomerModel.getAllCustomers();
  }
}
