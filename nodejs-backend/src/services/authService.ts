import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/userModel";
import { InvalidCredentialsError } from "../utils/customErrors";

export class AuthService {
  async login(email: string, password: string) {
    const userModel = await UserModel.getByEmail(email);
    if (!userModel || !userModel.password) {
      throw new InvalidCredentialsError();
    }

    if (bcrypt.compareSync(password, userModel.password)) {
      // gerar o jwt
      return jwt.sign({ id: userModel.id, email: userModel.email }, "123456", {
        expiresIn: "1h",
      });
    } else {
      throw new InvalidCredentialsError();
    }
  }
}
