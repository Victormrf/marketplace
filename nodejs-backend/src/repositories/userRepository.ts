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

const USER_DEACTIVATION_SELECT = {
  ...USER_SAFE_SELECT,
  deactivatedAt: true,
  seller: { select: { id: true, isActive: true } },
} satisfies Prisma.UserSelect;

export type UserSafeRecord = Prisma.UserGetPayload<{
  select: typeof USER_SAFE_SELECT;
}>;
export type UserAuthRecord = Prisma.UserGetPayload<{
  select: typeof USER_AUTH_SELECT;
}>;
export type UserDeactivationRecord = Prisma.UserGetPayload<{
  select: typeof USER_DEACTIVATION_SELECT;
}>;

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

  async findForAuthentication(
    normalizedEmail: string,
  ): Promise<UserAuthRecord | null> {
    return prisma.user.findUnique({
      where: { normalizedEmail },
      select: USER_AUTH_SELECT,
    });
  }

  async findIdentity(id: string): Promise<UserSafeRecord | null> {
    return this.findById(id);
  }

  async create(data: UserCreateData): Promise<UserSafeRecord> {
    return prisma.user.create({ data, select: USER_SAFE_SELECT });
  }

  async update(id: string, data: UserUpdateData): Promise<UserSafeRecord> {
    return prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT,
    });
  }

  async findForDeactivation(
    id: string,
  ): Promise<UserDeactivationRecord | null> {
    return prisma.user.findUnique({
      where: { id },
      select: USER_DEACTIVATION_SELECT,
    });
  }

  async deactivateWithSeller(
    record: UserDeactivationRecord,
    deactivationTime: Date,
  ): Promise<UserSafeRecord> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (record.isActive) {
        await tx.user.updateMany({
          where: { id: record.id, isActive: true },
          data: { isActive: false, deactivatedAt: deactivationTime },
        });
      }
      if (record.seller?.isActive) {
        await tx.seller.updateMany({
          where: { id: record.seller.id, isActive: true },
          data: { isActive: false, deactivatedAt: deactivationTime },
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { id: record.id },
        select: USER_SAFE_SELECT,
      });
    });
  }
}

export const userRepository = new UserRepository();
