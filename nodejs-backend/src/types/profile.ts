import type { UserDto } from "./user";

export type CustomerProfileDto = { id: string; userId: string; phone: string | null };
export type CustomerProfileWithUserDto = CustomerProfileDto & { user: UserDto };
export type CustomerProfileInput = Record<string, unknown>;
export type SellerProfileDto = { id: string; userId: string; storeName: string; logo: string | null; description: string | null; isActive: boolean };
export type SellerProfileWithUserDto = SellerProfileDto & { user: UserDto };
export type SellerProfileInput = Record<string, unknown>;
