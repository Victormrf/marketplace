import { Prisma } from "@prisma/client";
import { UserModel, UserRole } from "../models/userModel";
import {
  ConflictError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

interface UserInputData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export class UserService {
  async getById(userId: string) {
    const user = await UserModel.getById(userId);
    if (!user) {
      throw new ObjectNotFoundError("User");
    }
    return user;
  }

  async create(data: UserInputData) {
    if (!data.email || !data.password || !data.name || !data.role) {
      throw new ValidationError("Missing required fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ValidationError("Invalid email format");
    }

    try {
      return await UserModel.create(data);
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError("Email already on use");
      }
      throw error; // Re-lança o erro
    }
  }

  async update(userId: string, data: Partial<UserInputData>) {
    const user = await UserModel.getById(userId);

    if (!user) {
      throw new ObjectNotFoundError("User");
    }

    // Validação do e-mail, se fornecido
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new ValidationError("Invalid email format");
      }
    }

    try {
      return await UserModel.update(userId, data);
    } catch (error: any) {
      throw new Error(`Failed to update user: ${(error as Error).message}`);
    }
  }

  async delete(userId: string) {
    const user = await UserModel.getById(userId);

    if (!user) {
      throw new ObjectNotFoundError("User");
    }

    return await UserModel.delete(userId);
  }
}
