import { Router } from "express";
import { AuthService } from "../services/authService";
import { InvalidCredentialsError } from "../utils/customErrors";

export const authRoutes = Router();
const authService = new AuthService();

authRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const token = await authService.login(email, password);

    // Define o cookie HttpOnly com o token
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 1 dia
    });

    res.send({
      message: "User logged in successfully.",
    });
  } catch (e: any) {
    if (e instanceof InvalidCredentialsError) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    res.status(500).json({ error: e.message, stack: e.stack });
    return;
  }
});

authRoutes.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({ message: "User logged out successfully." });
});
