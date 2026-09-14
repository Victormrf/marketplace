import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { userRepository } from "../repositories/userRepository";
import { normalizeEmail } from "../utils/email";
import { InvalidCredentialsError } from "../utils/customErrors";
import { requireJwtSecret } from "../utils/jwt";

export class AuthService {
  async login(email: unknown, password: unknown): Promise<string> {
    if (typeof email !== "string" || typeof password !== "string") throw new InvalidCredentialsError();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) throw new InvalidCredentialsError();
    const user = await userRepository.findForAuthentication(normalizedEmail);
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      throw new InvalidCredentialsError();
    }
    return jwt.sign({ sub: user.id }, requireJwtSecret(), { expiresIn: "1h" });
  }
}
