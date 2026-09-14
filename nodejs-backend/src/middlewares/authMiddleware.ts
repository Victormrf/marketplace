import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { userRepository } from "../repositories/userRepository";
import { requireJwtSecret } from "../utils/jwt";

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("Authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = tokenFromHeader || req.cookies?.token;
  if (!token) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  try {
    const decoded = jwt.verify(token, requireJwtSecret()) as JwtPayload;
    if (typeof decoded.sub !== "string") throw new Error("Invalid subject");
    const user = await userRepository.findIdentity(decoded.sub);
    if (!user || !user.isActive || !Object.values(UserRole).includes(user.role)) throw new Error("Inactive identity");
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid credentials" });
  }
}
