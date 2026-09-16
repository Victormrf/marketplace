import type { UserRole } from "@prisma/client";

export type AuthenticatedUserDto = { id: string; email: string; role: UserRole };
