import { CustomerModel } from "../models/customerModel";
import { SellerModel } from "../models/sellerModel";
import {
  ObjectNotFoundError,
  ExistingProfileError,
  ValidationError,
} from "../utils/customErrors";

interface CustomerData {
  address: string;
  phone: string;
}

export class CustomerService {
  async createCustomerProfile(userId: string, customerData: CustomerData) {
    if (!customerData.address || !customerData.phone) {
      throw new ValidationError("Missing required fields");
    }

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

  async getCustomerProfile(userId: string) {
    const customer = await CustomerModel.getByUserId(userId);

    if (!customer) {
      throw new ObjectNotFoundError("Customer");
    }

    return customer;
  }

  async updateCustomerProfile(userId: string, data: Partial<CustomerData>) {
    const customer = await CustomerModel.getByUserId(userId);

    if (!customer) {
      throw new ObjectNotFoundError("Customer");
    }

    try {
      return await CustomerModel.updateCustomer(userId, data);
    } catch (error: any) {
      throw new Error(`Failed to update customer: ${(error as Error).message}`);
    }
  }

  async deleteCustomerProfile(userId: string): Promise<void> {
    const customer = await CustomerModel.getByUserId(userId);

    if (!customer) {
      throw new ObjectNotFoundError("Customer");
    }

    try {
      return await CustomerModel.deleteCustomer(userId);
    } catch (error: any) {
      throw new Error(`Failed to delete customer: ${(error as Error).message}`);
    }
  }
}
