import type { AuthenticatedUserDto } from "./auth";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user: AuthenticatedUserDto;
    }
  }
}

export {};
