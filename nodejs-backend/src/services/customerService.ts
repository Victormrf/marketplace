import { UserRole } from "@prisma/client";
import { customerRepository, CustomerRecord, CustomerWithUserRecord } from "../repositories/customerRepository";
import { sellerRepository } from "../repositories/sellerRepository";
import { userRepository } from "../repositories/userRepository";
import { ExistingProfileError, ForbiddenError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export type CustomerProfileInput = Record<string, unknown>;

function profileData(input: CustomerProfileInput) {
  const unknown = Object.keys(input).find((field) => field !== "phone");
  if (unknown) throw new ValidationError(`Unsupported customer field: ${unknown}`);
  if (input.phone !== undefined && input.phone !== null && typeof input.phone !== "string") {
    throw new ValidationError("phone must be a string");
  }
  return { phone: input.phone === undefined || input.phone === null ? null : input.phone.trim() || null };
}

export class CustomerService {
  async createCustomerProfile(userId: string, input: CustomerProfileInput): Promise<CustomerRecord> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ObjectNotFoundError("User");
    if (user.role !== UserRole.CUSTOMER) throw new ForbiddenError("Only CUSTOMER users can create a customer profile");
    if (await customerRepository.findByUserId(userId) || await sellerRepository.findByUserId(userId)) throw new ExistingProfileError();
    try {
      return await customerRepository.create({ userId, ...profileData(input) });
    } catch (error: any) {
      if (error?.code === "P2002") throw new ExistingProfileError();
      throw error;
    }
  }

  async getAllCustomers(): Promise<CustomerWithUserRecord[]> {
    return customerRepository.findAll();
  }

  async getCustomerProfile(userId: string): Promise<CustomerRecord> {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new ObjectNotFoundError("Customer");
    return customer;
  }

  async updateCustomerProfile(userId: string, input: CustomerProfileInput): Promise<CustomerRecord> {
    if (!(await customerRepository.findByUserId(userId))) throw new ObjectNotFoundError("Customer");
    return customerRepository.update(userId, profileData(input));
  }

  async deleteCustomerProfile(): Promise<void> {
    throw new ValidationError("Customer profiles are not physically deleted");
  }
}

export const customerService = new CustomerService();
