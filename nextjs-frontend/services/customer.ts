import { browserRequest } from "@/lib/http";
import type { Customer } from "@/types/customer";

export type CustomerProfileInput = {
  phone?: string | null;
};

export async function getMyCustomerProfile(): Promise<Customer> {
  return browserRequest<Customer>("/api/customers");
}

export async function createMyCustomerProfile(
  input: CustomerProfileInput,
): Promise<Customer> {
  return browserRequest<Customer>("/api/customers", {
    method: "POST",
    json: input,
  });
}

export async function updateMyCustomerProfile(
  input: CustomerProfileInput,
): Promise<Customer> {
  return browserRequest<Customer>("/api/customers", {
    method: "PUT",
    json: input,
  });
}
