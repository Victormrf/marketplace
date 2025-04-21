import { Request, Response, NextFunction } from "express";

export function roleMiddleware(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !user.role) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ message: "Access denied. Insufficient role." });
      return;
    }

    next();
  };
}
