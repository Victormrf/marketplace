import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { USER_SAFE_SELECT } from "./userRepository";

const SELLER_SELECT = {
  id: true,
  userId: true,
  storeName: true,
  logo: true,
  description: true,
  isActive: true,
} satisfies Prisma.SellerSelect;

const SELLER_WITH_USER_SELECT = {
  ...SELLER_SELECT,
  user: { select: USER_SAFE_SELECT },
} satisfies Prisma.SellerSelect;

const SELLER_DEACTIVATION_SELECT = {
  ...SELLER_SELECT,
  deactivatedAt: true,
} satisfies Prisma.SellerSelect;

export type SellerRecord = Prisma.SellerGetPayload<{
  select: typeof SELLER_SELECT;
}>;
export type SellerWithUserRecord = Prisma.SellerGetPayload<{
  select: typeof SELLER_WITH_USER_SELECT;
}>;
export type SellerDeactivationRecord = Prisma.SellerGetPayload<{
  select: typeof SELLER_DEACTIVATION_SELECT;
}>;

export class SellerRepository {
  async findByUserId(userId: string): Promise<SellerRecord | null> {
    return prisma.seller.findUnique({
      where: { userId },
      select: SELLER_SELECT,
    });
  }

  async findAll(): Promise<SellerWithUserRecord[]> {
    return prisma.seller.findMany({
      select: SELLER_WITH_USER_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: {
    userId: string;
    storeName: string;
    logo?: string | null;
    description?: string | null;
  }): Promise<SellerRecord> {
    return prisma.seller.create({ data, select: SELLER_SELECT });
  }

  async update(
    userId: string,
    data: {
      storeName?: string;
      logo?: string | null;
      description?: string | null;
    },
  ): Promise<SellerRecord> {
    return prisma.seller.update({
      where: { userId },
      data,
      select: SELLER_SELECT,
    });
  }

  async findForDeactivation(
    userId: string,
  ): Promise<SellerDeactivationRecord | null> {
    return prisma.seller.findUnique({
      where: { userId },
      select: SELLER_DEACTIVATION_SELECT,
    });
  }

  async deactivate(
    record: SellerDeactivationRecord,
    deactivationTime: Date,
  ): Promise<SellerRecord> {
    await prisma.seller.updateMany({
      where: { id: record.id, isActive: true },
      data: { isActive: false, deactivatedAt: deactivationTime },
    });
    return prisma.seller.findUniqueOrThrow({
      where: { id: record.id },
      select: SELLER_SELECT,
    });
  }
}

export const sellerRepository = new SellerRepository();
