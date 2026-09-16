export type CustomerAddressInput = Record<string, unknown>;
export type CustomerAddressDto = {
  id: string; recipientName: string; postalCode: string; street: string; number: string; complement: string | null;
  neighborhood: string; city: string; state: string; countryCode: "BR"; phone: string | null;
  isDefault: boolean; createdAt: Date; updatedAt: Date;
};
