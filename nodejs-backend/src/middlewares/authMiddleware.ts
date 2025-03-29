import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SECRET_KEY as string;

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Acesso negado. Token não fornecido." });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    (req as any).user = decoded; // Anexa os dados do usuário à requisição
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
}
