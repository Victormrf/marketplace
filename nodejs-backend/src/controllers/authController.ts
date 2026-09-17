import { Router } from "express";
import { AuthService } from "../services/authService";
import { InvalidCredentialsError } from "../utils/customErrors";
import { cookieOptions } from "../utils/jwt";

export const authRoutes = Router();
const authService = new AuthService();

authRoutes.post("/login", async (req, res) => {
  try {
    const token = await authService.login(req.body?.email, req.body?.password);
    res.cookie("token", token, cookieOptions());
    res.status(200).json({ message: "User logged in successfully." });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
});

authRoutes.post("/logout", (req, res) => {
  const options = cookieOptions();
  res.clearCookie("token", {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
  });
  res.status(200).json({ message: "User logged out successfully." });
});
