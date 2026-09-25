import { browserRequest } from "@/lib/http";
import type { AuthenticatedUserDto, UserRole } from "@/types/auth";

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  name: string;
  role: Exclude<UserRole, "ADMIN">;
};

export function login(input: LoginInput): Promise<{ message: string }> {
  return browserRequest<{ message: string }>("/api/session/login", {
    method: "POST",
    json: input,
  });
}

export function logout(): Promise<{ message: string }> {
  return browserRequest<{ message: string }>("/api/session/logout", {
    method: "POST",
    json: {},
  });
}

export function register(input: RegisterInput): Promise<AuthenticatedUserDto> {
  return browserRequest<AuthenticatedUserDto>("/api/auth/register", {
    method: "POST",
    json: input,
  });
}
