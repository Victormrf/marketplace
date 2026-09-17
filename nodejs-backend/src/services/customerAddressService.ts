import { UserRole } from "@prisma/client";
import { customerAddressRepository } from "../repositories/customerAddressRepository";
import type {
  CustomerAddressData,
  CustomerAddressRecord,
} from "../repositories/customerAddressRepository";
import { customerRepository } from "../repositories/customerRepository";
import { userRepository } from "../repositories/userRepository";
import {
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { PaginationInput } from "../types/productRead";
import type {
  CustomerAddressDto,
  CustomerAddressInput,
} from "../types/customerAddress";

function toDto(address: CustomerAddressRecord): CustomerAddressDto {
  return { ...address, countryCode: "BR" };
}

const ADDRESS_FIELDS = new Set([
  "recipientName",
  "postalCode",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "countryCode",
  "phone",
  "isDefault",
]);
const UPDATE_FIELDS = new Set([
  "recipientName",
  "postalCode",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "countryCode",
  "phone",
]);

function rejectUnknown(input: CustomerAddressInput, allowed: Set<string>) {
  const unknown = Object.keys(input).find((field) => !allowed.has(field));
  if (unknown)
    throw new ValidationError(`Unsupported address field: ${unknown}`);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new ValidationError(`${field} is required`);
  return value.trim();
}

function normalizeAddress(
  input: CustomerAddressInput,
  includeDefault: boolean,
) {
  rejectUnknown(input, includeDefault ? ADDRESS_FIELDS : UPDATE_FIELDS);
  if (!includeDefault) {
    if (Object.keys(input).length === 0)
      throw new ValidationError("No fields to update");
    const data: Record<string, unknown> = {};
    if ("recipientName" in input)
      data.recipientName = requiredString(input.recipientName, "recipientName");
    if ("postalCode" in input)
      data.postalCode = normalizePostalCode(input.postalCode);
    if ("street" in input) data.street = requiredString(input.street, "street");
    if ("number" in input) data.number = requiredString(input.number, "number");
    if ("complement" in input)
      data.complement = optionalString(input.complement, "complement");
    if ("neighborhood" in input)
      data.neighborhood = requiredString(input.neighborhood, "neighborhood");
    if ("city" in input) data.city = requiredString(input.city, "city");
    if ("state" in input)
      data.state = requiredString(input.state, "state").toUpperCase();
    if ("countryCode" in input)
      data.countryCode = normalizeCountry(input.countryCode);
    if ("phone" in input) data.phone = optionalString(input.phone, "phone");
    return { data };
  }
  const data = {
    recipientName: requiredString(input.recipientName, "recipientName"),
    postalCode: normalizePostalCode(input.postalCode),
    street: requiredString(input.street, "street"),
    number: requiredString(input.number, "number"),
    complement: optionalString(input.complement, "complement"),
    neighborhood: requiredString(input.neighborhood, "neighborhood"),
    city: requiredString(input.city, "city"),
    state: requiredString(input.state, "state").toUpperCase(),
    countryCode: normalizeCountry(input.countryCode),
    phone: optionalString(input.phone, "phone"),
  };
  if (includeDefault) {
    if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") {
      throw new ValidationError("isDefault must be boolean");
    }
    return { data, requestedDefault: input.isDefault === true };
  }
  return { data };
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string")
    throw new ValidationError(`${field} must be a string`);
  return value.trim() || null;
}

function normalizePostalCode(value: unknown): string {
  const postalCode = requiredString(value, "postalCode");
  if (!/^\d{5}-?\d{3}$/.test(postalCode))
    throw new ValidationError("Invalid postalCode");
  return postalCode.replace("-", "");
}

function normalizeCountry(value: unknown): "BR" {
  if (value === undefined) return "BR";
  if (typeof value !== "string" || value.trim().toUpperCase() !== "BR")
    throw new ValidationError("Only BR countryCode is supported");
  return "BR";
}

export class CustomerAddressService {
  constructor(private readonly repository = customerAddressRepository) {}

  private async customerIdFor(userId: string): Promise<string> {
    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) throw new ObjectNotFoundError("Customer");
    if (user.role !== UserRole.CUSTOMER)
      throw new ForbiddenError("Only CUSTOMER users can manage addresses");
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new ObjectNotFoundError("Customer");
    return customer.id;
  }

  async list(userId: string, pagination: PaginationInput) {
    const customerId = await this.customerIdFor(userId);
    const [total, data] = await Promise.all([
      this.repository.count(customerId),
      this.repository.findMany(
        customerId,
        (pagination.page - 1) * pagination.limit,
        pagination.limit,
      ),
    ]);
    return {
      data: data.map(toDto),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async get(userId: string, addressId: string): Promise<CustomerAddressDto> {
    const customerId = await this.customerIdFor(userId);
    const address = await this.repository.findActiveById(customerId, addressId);
    if (!address) throw new ObjectNotFoundError("Customer address");
    return toDto(address);
  }

  async create(
    userId: string,
    input: CustomerAddressInput,
  ): Promise<CustomerAddressDto> {
    const customerId = await this.customerIdFor(userId);
    const normalized = normalizeAddress(input, true);
    return toDto(
      await this.repository.create(
        customerId,
        normalized.data as CustomerAddressData,
        normalized.requestedDefault ?? false,
      ),
    );
  }

  async update(
    userId: string,
    addressId: string,
    input: CustomerAddressInput,
  ): Promise<CustomerAddressDto> {
    const customerId = await this.customerIdFor(userId);
    if (Object.keys(input).length === 0)
      throw new ValidationError("No fields to update");
    const normalized = normalizeAddress(input, false);
    const address = await this.repository.update(
      customerId,
      addressId,
      normalized.data as Partial<CustomerAddressData>,
    );
    if (!address) throw new ObjectNotFoundError("Customer address");
    return toDto(address);
  }

  async setDefault(
    userId: string,
    addressId: string,
  ): Promise<CustomerAddressDto> {
    const customerId = await this.customerIdFor(userId);
    const address = await this.repository.setDefault(customerId, addressId);
    if (!address) throw new ObjectNotFoundError("Customer address");
    return toDto(address);
  }

  async deactivate(userId: string, addressId: string): Promise<void> {
    const customerId = await this.customerIdFor(userId);
    const address = await this.repository.deactivate(customerId, addressId);
    if (!address) throw new ObjectNotFoundError("Customer address");
  }
}

export const customerAddressService = new CustomerAddressService();
