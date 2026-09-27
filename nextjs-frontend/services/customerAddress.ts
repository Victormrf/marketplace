import { browserRequest } from "@/lib/http";
import type {
  CustomerAddressCollectionDto,
  CustomerAddressDto,
  CustomerAddressInput,
  CustomerAddressUpdateInput,
} from "@/types/customerAddress";

const ADDRESS_PATH = "/api/customers/addresses";

export function listCustomerAddresses(page = 1, limit = 20) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return browserRequest<CustomerAddressCollectionDto>(`${ADDRESS_PATH}?${query}`);
}

export function getCustomerAddress(addressId: string) {
  return browserRequest<CustomerAddressDto>(
    `${ADDRESS_PATH}/${encodeURIComponent(addressId)}`,
  );
}

export function createCustomerAddress(input: CustomerAddressInput) {
  return browserRequest<CustomerAddressDto>(ADDRESS_PATH, {
    method: "POST",
    json: input,
  });
}

export function updateCustomerAddress(
  addressId: string,
  input: CustomerAddressUpdateInput,
) {
  return browserRequest<CustomerAddressDto>(
    `${ADDRESS_PATH}/${encodeURIComponent(addressId)}`,
    { method: "PUT", json: input },
  );
}

export function setDefaultCustomerAddress(addressId: string) {
  return browserRequest<CustomerAddressDto>(
    `${ADDRESS_PATH}/${encodeURIComponent(addressId)}/default`,
    { method: "PUT", json: {} },
  );
}

export function deactivateCustomerAddress(addressId: string) {
  return browserRequest<void>(
    `${ADDRESS_PATH}/${encodeURIComponent(addressId)}`,
    { method: "DELETE" },
  );
}
