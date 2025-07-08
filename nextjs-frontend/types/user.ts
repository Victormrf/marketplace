import { Customer } from "./customer";
import { Seller } from "./seller";

export enum UserRole {
  CUSTOMER = "CUSTOMER",
  SELLER = "SELLER",
}

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
};

export type UserProfile = {
  user: User;
  customer?: Customer;
  seller?: Seller;
};
