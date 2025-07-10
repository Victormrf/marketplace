import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

interface CustomJwtPayload extends JwtPayload {
  id: string;
  email: string;
  role?: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Lê do header Authorization ou do cookie chamado 'token'
  const authHeader = req.header("Authorization");
  const tokenFromHeader = authHeader?.replace("Bearer ", "");
  const tokenFromCookie = req.cookies?.token;

  console.log("Cookies recebidos:", req.cookies);

  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    res.status(401).json({ message: "Access denied. Token not informed." });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as CustomJwtPayload;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token." });
    return;
  }
}
