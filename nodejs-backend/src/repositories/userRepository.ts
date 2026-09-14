import { Prisma, UserRole } from "@prisma/client";
import prisma from "../config/db";

export const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const USER_AUTH_SELECT = {
  ...USER_SAFE_SELECT,
  password: true,
} satisfies Prisma.UserSelect;

export type UserSafeRecord = Prisma.UserGetPayload<{ select: typeof USER_SAFE_SELECT }>;
export type UserAuthRecord = Prisma.UserGetPayload<{ select: typeof USER_AUTH_SELECT }>;

export type UserCreateData = {
  name: string;
  email: string;
  normalizedEmail: string;
  password: string;
  role: UserRole;
};

export type UserUpdateData = {
  name?: string;
  email?: string;
  normalizedEmail?: string;
  password?: string;
};

export class UserRepository {
  async findById(id: string): Promise<UserSafeRecord | null> {
    return prisma.user.findUnique({ where: { id }, select: USER_SAFE_SELECT });
  }

  async findForAuthentication(normalizedEmail: string): Promise<UserAuthRecord | null> {
    return prisma.user.findUnique({ where: { normalizedEmail }, select: USER_AUTH_SELECT });
  }

  async findIdentity(id: string): Promise<UserSafeRecord | null> {
    return this.findById(id);
  }

  async create(data: UserCreateData): Promise<UserSafeRecord> {
    return prisma.user.create({ data, select: USER_SAFE_SELECT });
  }

  async update(id: string, data: UserUpdateData): Promise<UserSafeRecord> {
    return prisma.user.update({ where: { id }, data, select: USER_SAFE_SELECT });
  }

  async deactivateWithSeller(id: string): Promise<UserSafeRecord> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive: false, deactivatedAt: new Date() },
        select: USER_SAFE_SELECT,
      });
      await tx.seller.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      });
      return user;
    });
  }
}

export const userRepository = new UserRepository();
