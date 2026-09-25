export type UserRole = "ADMIN" | "SELLER" | "CUSTOMER";

export type AuthenticatedUserDto = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};
