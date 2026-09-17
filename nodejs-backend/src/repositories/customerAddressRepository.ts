import { Prisma } from "@prisma/client";
import prisma from "../config/db";

const ADDRESS_SELECT = {
  id: true,
  recipientName: true,
  postalCode: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  countryCode: true,
  phone: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerAddressSelect;

const ADDRESS_DEACTIVATION_SELECT = {
  ...ADDRESS_SELECT,
  isActive: true,
} satisfies Prisma.CustomerAddressSelect;

export type CustomerAddressRecord = Prisma.CustomerAddressGetPayload<{
  select: typeof ADDRESS_SELECT;
}>;

export type CustomerAddressData = Omit<
  CustomerAddressRecord,
  "id" | "createdAt" | "updatedAt" | "isDefault"
>;

async function lockCustomer(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "customer"
    WHERE "id" = ${customerId}
    FOR UPDATE
  `);
}

export class CustomerAddressRepository {
  async count(customerId: string): Promise<number> {
    return prisma.customerAddress.count({
      where: { customerId, isActive: true },
    });
  }

  async findMany(
    customerId: string,
    skip: number,
    take: number,
  ): Promise<CustomerAddressRecord[]> {
    return prisma.customerAddress.findMany({
      where: { customerId, isActive: true },
      select: ADDRESS_SELECT,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
    });
  }

  async findActiveById(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressRecord | null> {
    return prisma.customerAddress.findFirst({
      where: { id: addressId, customerId, isActive: true },
      select: ADDRESS_SELECT,
    });
  }

  async create(
    customerId: string,
    data: CustomerAddressData,
    requestedDefault: boolean,
  ): Promise<CustomerAddressRecord> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockCustomer(tx, customerId);
      const activeCount = await tx.customerAddress.count({
        where: { customerId, isActive: true },
      });
      const shouldBeDefault = requestedDefault || activeCount === 0;
      if (shouldBeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isActive: true, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.create({
        data: { ...data, customerId, isDefault: shouldBeDefault },
        select: ADDRESS_SELECT,
      });
    });
  }

  async update(
    customerId: string,
    addressId: string,
    data: Partial<CustomerAddressData>,
  ): Promise<CustomerAddressRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.customerAddress.updateMany({
        where: { id: addressId, customerId, isActive: true },
        data,
      });
      if (result.count === 0) return null;

      return tx.customerAddress.findUniqueOrThrow({
        where: { id: addressId },
        select: ADDRESS_SELECT,
      });
    });
  }

  async setDefault(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockCustomer(tx, customerId);
      const address = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId, isActive: true },
        select: ADDRESS_SELECT,
      });
      if (!address) return null;
      if (address.isDefault) return address;
      await tx.customerAddress.updateMany({
        where: { customerId, isActive: true, isDefault: true },
        data: { isDefault: false },
      });
      return tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
        select: ADDRESS_SELECT,
      });
    });
  }

  async deactivate(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockCustomer(tx, customerId);
      const address = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
        select: ADDRESS_DEACTIVATION_SELECT,
      });
      if (!address || !address.isActive) return address;
      return tx.customerAddress.update({
        where: { id: addressId },
        data: { isActive: false, isDefault: false },
        select: ADDRESS_SELECT,
      });
    });
  }
}

export const customerAddressRepository = new CustomerAddressRepository();
