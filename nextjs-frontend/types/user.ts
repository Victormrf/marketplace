import type { Customer } from "./customer";
import type { Seller } from "./seller";
import type { AuthenticatedUserDto } from "./auth";

export type User = AuthenticatedUserDto;

export type UserProfile = {
  user: User;
  customer?: Customer;
  seller?: Seller;
};
