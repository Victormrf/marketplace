import prisma from "../config/db";
import bcrypt from "bcrypt";

export class UserModel {
  id?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  createdAt?: Date;

  constructor(data: Partial<UserModel> = {}) {
    this.fill(data);
  }

  static async create(data: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Promise<UserModel> {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
    });
  }

  static async getById(id: string): Promise<UserModel> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async getByEmail(email: string): Promise<UserModel> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  static async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    }
  ): Promise<void> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<void> {
    return prisma.user.delete({
      where: { id },
    });
  }

  fill(data: Partial<UserModel>): void {
    if (data.id !== undefined) this.id = data.id;
    if (data.name !== undefined) this.name = data.name;
    if (data.email !== undefined) this.email = data.email;
    if (data.password !== undefined) this.password = data.password;
    if (data.createdAt !== undefined) this.createdAt = data.createdAt;
  }
}
