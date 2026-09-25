import { browserRequest } from "@/lib/http";
import type { AuthenticatedUserDto } from "@/types/auth";

export type UpdateUserInput = {
  name?: string;
  email?: string;
  password?: string;
};

export function getCurrentUser(): Promise<AuthenticatedUserDto> {
  return browserRequest<AuthenticatedUserDto>("/api/users/me");
}

export function updateCurrentUser(input: UpdateUserInput): Promise<AuthenticatedUserDto> {
  return browserRequest<AuthenticatedUserDto>("/api/users/me", {
    method: "PUT",
    json: input,
  });
}
