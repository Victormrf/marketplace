import type { UserRole } from "@prisma/client";

export type UserDto = { id: string; name: string; email: string; role: UserRole; isActive: boolean; createdAt: Date };
export type UserRegistrationInput = Record<string, unknown>;
export type UserUpdateInput = Record<string, unknown>;
