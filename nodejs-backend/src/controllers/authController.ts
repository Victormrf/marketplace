import { Router } from "express";
import { AuthService } from "../services/authService";
import { InvalidCredentialsError } from "../utils/customErrors";

export const authRoutes = Router();
const authService = new AuthService();

authRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const token = await authService.login(email, password);
    res.send({ token });
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      res.status(401).json({ message: "Invalid credentials" });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
});
