import { NextFunction, Request, Response } from "express";
import { UserService } from "../services/userService";

const userService = new UserService();

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { user } = req as any;

    if (!user || !user.id) {
      res.status(401).json({ message: "User not auhenticated." });
      return;
    }

    const userData = await userService.getById(user.id);

    if (!userData || userData.role !== "admin") {
      res.status(403).json({
        message: "Access denied.",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error." });
    return;
  }
}
