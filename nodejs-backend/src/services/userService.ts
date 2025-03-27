import { UserModel } from "../models/userModel";
import { UserNotFoundError, ValidationError } from "../utils/customErrors";

interface UserInputData {
  name: string;
  email: string;
  password: string;
  role: string;
}

export class UserService {
  async getById(userId: string) {
    const user = await UserModel.getById(userId);
    if (!user) {
      throw new UserNotFoundError();
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
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create user: ${(error as Error).message}`);
      }
    }
  }

  async update(userId: string, data: Partial<UserInputData>) {
    const user = await UserModel.getById(userId);

    if (!user) {
      throw new UserNotFoundError();
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
    } catch (error) {
      throw new Error(`Failed to update user: ${(error as Error).message}`);
    }
  }
}

// export const getUserById = async (id: string) => {
//   const user = await userModel.getUserById(id);
//   if (!user) {
//     throw new Error("User not found");
//   }
//   return user;
// };

// export const createUser = async (data: {
//   name: string;
//   email: string;
//   password: string;
//   role: string;
// }) => {
//   const user = await userModel.createUser(data);
//   return user;
// };

// export const updateUser = async (
//   id: string,
//   data: {
//     name?: string;
//     email?: string;
//     password?: string;
//     role?: string;
//   }
// ) => {
//   const user = await userModel.updateUser(id, data);
//   return user;
// };

// export const deleteUser = async (id: string) => {
//   await userModel.deleteUser(id);
// };
