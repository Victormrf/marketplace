import prisma from "../config/db";

export class UserModel {
  id?: number;
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
    return prisma.user.create({
      data,
    });
  }

  static async getById(id: string): Promise<UserModel> {
    return prisma.user.findUnique({
      where: { id },
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
