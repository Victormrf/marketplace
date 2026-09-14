import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { USER_SAFE_SELECT } from "./userRepository";

const CUSTOMER_SELECT = {
  id: true,
  userId: true,
  phone: true,
} satisfies Prisma.CustomerProfileSelect;

const CUSTOMER_WITH_USER_SELECT = {
  ...CUSTOMER_SELECT,
  user: { select: USER_SAFE_SELECT },
} satisfies Prisma.CustomerProfileSelect;

export type CustomerRecord = Prisma.CustomerProfileGetPayload<{ select: typeof CUSTOMER_SELECT }>;
export type CustomerWithUserRecord = Prisma.CustomerProfileGetPayload<{
  select: typeof CUSTOMER_WITH_USER_SELECT;
}>;

export class CustomerRepository {
  async findByUserId(userId: string): Promise<CustomerRecord | null> {
    return prisma.customerProfile.findUnique({ where: { userId }, select: CUSTOMER_SELECT });
  }

  async findAll(): Promise<CustomerWithUserRecord[]> {
    return prisma.customerProfile.findMany({
      select: CUSTOMER_WITH_USER_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: { userId: string; phone?: string | null }): Promise<CustomerRecord> {
    return prisma.customerProfile.create({ data, select: CUSTOMER_SELECT });
  }

  async update(userId: string, data: { phone?: string | null }): Promise<CustomerRecord> {
    return prisma.customerProfile.update({ where: { userId }, data, select: CUSTOMER_SELECT });
  }
}

export const customerRepository = new CustomerRepository();
