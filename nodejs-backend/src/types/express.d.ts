import type { AuthenticatedUserDto } from "./auth";

declare global {
  namespace Express {
    interface Request {
      user: AuthenticatedUserDto;
    }
  }
}

export {};
