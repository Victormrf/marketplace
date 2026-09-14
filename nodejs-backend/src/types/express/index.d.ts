import { Express } from "express-serve-static-core";
import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}
