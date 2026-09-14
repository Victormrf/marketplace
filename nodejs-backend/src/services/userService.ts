import bcrypt from "bcrypt";
import { Prisma, UserRole } from "@prisma/client";
import { userRepository, UserSafeRecord } from "../repositories/userRepository";
import { normalizeEmail } from "../utils/email";
import { ConflictError, ForbiddenError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export type UserDto = UserSafeRecord;
export type UserRegistrationInput = Record<string, unknown>;
export type UserUpdateInput = Record<string, unknown>;

const REGISTRATION_FIELDS = new Set(["name", "email", "password", "role"]);
const UPDATE_FIELDS = new Set(["name", "email", "password"]);

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ValidationError(`${field} is required`);
  return value.trim();
}

function validateEmail(value: unknown): string {
  const email = requiredString(value, "email");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ValidationError("Invalid email format");
  return normalizeEmail(email);
}

function rejectUnknown(input: Record<string, unknown>, fields: Set<string>) {
  const unknown = Object.keys(input).find((field) => !fields.has(field));
  if (unknown) throw new ValidationError(`Unsupported user field: ${unknown}`);
}

export class UserService {
  async getById(userId: string): Promise<UserDto> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ObjectNotFoundError("User");
    return user;
  }

  async create(input: UserRegistrationInput): Promise<UserDto> {
    rejectUnknown(input, REGISTRATION_FIELDS);
    const name = requiredString(input.name, "name");
    const normalizedEmail = validateEmail(input.email);
    const password = requiredString(input.password, "password");
    if (password.length < 6) throw new ValidationError("password must contain at least 6 characters");
    if (input.role !== UserRole.CUSTOMER && input.role !== UserRole.SELLER) {
      throw new ValidationError("Only CUSTOMER or SELLER registration is allowed");
    }
    try {
      return await userRepository.create({
        name,
        email: normalizedEmail,
        normalizedEmail,
        password: await bcrypt.hash(password, 10),
        role: input.role,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Email already in use");
      throw error;
    }
  }

  async update(userId: string, input: UserUpdateInput): Promise<UserDto> {
    rejectUnknown(input, UPDATE_FIELDS);
    if (Object.keys(input).length === 0) throw new ValidationError("No fields to update");
    if (!(await userRepository.findById(userId))) throw new ObjectNotFoundError("User");
    const data: { name?: string; email?: string; normalizedEmail?: string; password?: string } = {};
    if ("name" in input) data.name = requiredString(input.name, "name");
    if ("email" in input) {
      data.email = validateEmail(input.email);
      data.normalizedEmail = data.email;
    }
    if ("password" in input) {
      const password = requiredString(input.password, "password");
      if (password.length < 6) throw new ValidationError("password must contain at least 6 characters");
      data.password = await bcrypt.hash(password, 10);
    }
    try {
      return await userRepository.update(userId, data);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Email already in use");
      throw error;
    }
  }

  async deactivate(userId: string, actor: { id: string; role?: string }): Promise<UserDto> {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenError();
    const record = await userRepository.findForDeactivation(userId);
    if (!record) throw new ObjectNotFoundError("User");
    if (!record.isActive && !record.seller?.isActive) {
      return record;
    }
    return userRepository.deactivateWithSeller(record, new Date());
  }
}

export const userService = new UserService();
