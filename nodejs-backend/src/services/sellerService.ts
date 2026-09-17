import { UserRole } from "@prisma/client";
import { customerRepository } from "../repositories/customerRepository";
import { sellerRepository } from "../repositories/sellerRepository";
import type {
  SellerRecord,
  SellerWithUserRecord,
} from "../repositories/sellerRepository";
import { userRepository } from "../repositories/userRepository";
import {
  ExistingProfileError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import type { SellerProfileInput } from "../types/profile";
import type {
  SellerProfileDto,
  SellerProfileWithUserDto,
} from "../types/profile";

function sellerData(input: SellerProfileInput, allowEmpty = false) {
  const allowed = new Set(["storeName", "description", "logo"]);
  const unknown = Object.keys(input).find((field) => !allowed.has(field));
  if (unknown)
    throw new ValidationError(`Unsupported seller field: ${unknown}`);
  const data: {
    storeName?: string;
    description?: string | null;
    logo?: string | null;
  } = {};
  if ("storeName" in input) {
    if (typeof input.storeName !== "string" || input.storeName.trim() === "")
      throw new ValidationError("storeName is required");
    data.storeName = input.storeName.trim();
  } else if (!allowEmpty) throw new ValidationError("storeName is required");
  if ("description" in input) {
    if (input.description !== null && typeof input.description !== "string")
      throw new ValidationError("description must be a string");
    data.description =
      input.description === null
        ? null
        : (input.description as string).trim() || null;
  }
  if ("logo" in input) {
    if (input.logo !== null && typeof input.logo !== "string")
      throw new ValidationError("logo must be a string");
    data.logo =
      input.logo === null ? null : (input.logo as string).trim() || null;
  }
  return data;
}

export class SellerService {
  private toDto(record: SellerRecord): SellerProfileDto {
    return {
      id: record.id,
      userId: record.userId,
      storeName: record.storeName,
      logo: record.logo,
      description: record.description,
      isActive: record.isActive,
    };
  }

  private toWithUserDto(
    record: SellerWithUserRecord,
  ): SellerProfileWithUserDto {
    return { ...this.toDto(record), user: record.user };
  }

  async createSellerProfile(
    userId: string,
    input: SellerProfileInput,
  ): Promise<SellerProfileDto> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ObjectNotFoundError("User");
    if (user.role !== UserRole.SELLER)
      throw new ForbiddenError("Only SELLER users can create a seller profile");
    if (
      (await sellerRepository.findByUserId(userId)) ||
      (await customerRepository.findByUserId(userId))
    )
      throw new ExistingProfileError();
    try {
      const data = sellerData(input);
      if (!data.storeName) throw new ValidationError("storeName is required");
      return this.toDto(
        await sellerRepository.create({
          userId,
          storeName: data.storeName,
          logo: data.logo,
          description: data.description,
        }),
      );
    } catch (error: any) {
      if (error?.code === "P2002") throw new ExistingProfileError();
      throw error;
    }
  }

  async getAllSellers(): Promise<SellerProfileWithUserDto[]> {
    return (await sellerRepository.findAll()).map((record) =>
      this.toWithUserDto(record),
    );
  }

  async getSellerProfile(userId: string): Promise<SellerProfileDto> {
    const seller = await sellerRepository.findByUserId(userId);
    if (!seller) throw new ObjectNotFoundError("Seller");
    return this.toDto(seller);
  }

  async updateSellerProfile(
    userId: string,
    input: SellerProfileInput,
  ): Promise<SellerProfileDto> {
    if (!(await sellerRepository.findByUserId(userId)))
      throw new ObjectNotFoundError("Seller");
    return this.toDto(
      await sellerRepository.update(userId, sellerData(input, true)),
    );
  }

  async deactivateSeller(
    userId: string,
    actor: { id: string; role?: string },
  ): Promise<SellerProfileDto> {
    if (actor.role !== UserRole.ADMIN && actor.id !== userId)
      throw new ForbiddenError();
    const record = await sellerRepository.findForDeactivation(userId);
    if (!record) throw new ObjectNotFoundError("Seller");
    if (!record.isActive) {
      return this.toDto(record);
    }
    return this.toDto(await sellerRepository.deactivate(record, new Date()));
  }

  async deleteSellerProfile(): Promise<void> {
    throw new ValidationError("Seller profiles are not physically deleted");
  }
}

export const sellerService = new SellerService();
