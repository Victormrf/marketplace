export type CustomerAddressDto = {
  id: string;
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  countryCode: "BR";
  phone: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddressCollectionDto = {
  data: CustomerAddressDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CustomerAddressInput = {
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  countryCode?: "BR";
  phone?: string | null;
  isDefault?: boolean;
};

export type CustomerAddressUpdateInput = Partial<
  Omit<CustomerAddressInput, "isDefault">
>;
