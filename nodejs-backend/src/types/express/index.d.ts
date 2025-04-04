import { Express } from "express-serve-static-core";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        name?: string;
        email?: string;
        role?: string;
      };
    }
  }
}
