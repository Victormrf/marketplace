import { Prisma, ProductCategory } from "@prisma/client";
import prisma from "../config/db";
import { ProductReadFilters } from "../types/productRead";

export type ProductReadRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_READ_SELECT;
}>;

export type ProductCreateData = {
  sellerId: string;
  name: string;
  reference?: string | null;
  description?: string | null;
  priceInCents: number;
  currency: "BRL";
  category: ProductCategory;
  image?: string | null;
};

export type ProductUpdateData = Partial<Omit<ProductCreateData, "sellerId">>;

const PRODUCT_READ_SELECT = {
  id: true,
  sellerId: true,
  name: true,
  reference: true,
  description: true,
  priceInCents: true,
  currency: true,
  category: true,
  image: true,
  createdAt: true,
  seller: { select: { storeName: true } },
  inventory: { select: { onHandQuantity: true, reservedQuantity: true } },
} satisfies Prisma.ProductSelect;

export interface ProductRepositoryPort {
  count(filters: ProductReadFilters): Promise<number>;
  findMany(
    filters: ProductReadFilters,
    skip: number,
    take: number,
  ): Promise<ProductReadRecord[]>;
  findById(id: string): Promise<ProductReadRecord | null>;
  averageRatings(productIds: string[]): Promise<Map<string, number>>;
  findActiveSellerByUserId(userId: string): Promise<{ id: string } | null>;
  findForAuthorization(
    id: string,
  ): Promise<{ id: string; sellerId: string; isActive: boolean } | null>;
  createWithInventory(
    data: ProductCreateData,
    initialInventory?: { onHandQuantity: number; reservedQuantity: number },
  ): Promise<{ id: string }>;
  updateProduct(id: string, data: ProductUpdateData): Promise<{ id: string }>;
  deactivateProduct(id: string, deactivatedAt: Date): Promise<{ id: string }>;
  getProductsByIds(productIds: string[]): Promise<ProductReadRecord[]>;
}

function buildWhere(filters: ProductReadFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [
    {
      isActive: true,
      seller: { isActive: true },
    },
  ];

  if (filters.search) {
    and.push({ name: { contains: filters.search, mode: "insensitive" } });
  }
  if (filters.category) {
    and.push({ category: filters.category });
  }
  if (filters.sellerId) {
    and.push({ sellerId: filters.sellerId });
  }
  if (filters.ids) {
    and.push({ id: { in: filters.ids } });
  }

  if (filters.inStock === true) {
    and.push({
      inventory: {
        is: {
          onHandQuantity: { gt: prisma.inventory.fields.reservedQuantity },
        },
      },
    });
  } else if (filters.inStock === false) {
    and.push({
      OR: [
        { inventory: { is: null } },
        {
          inventory: {
            is: {
              onHandQuantity: { lte: prisma.inventory.fields.reservedQuantity },
            },
          },
        },
      ],
    });
  }

  return { AND: and };
}

export class ProductRepository implements ProductRepositoryPort {
  async count(filters: ProductReadFilters): Promise<number> {
    return prisma.product.count({ where: buildWhere(filters) });
  }

  async findMany(
    filters: ProductReadFilters,
    skip: number,
    take: number,
  ): Promise<ProductReadRecord[]> {
    return prisma.product.findMany({
      where: buildWhere(filters),
      select: PRODUCT_READ_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
    });
  }

  async findById(id: string): Promise<ProductReadRecord | null> {
    return prisma.product.findFirst({
      where: { AND: [buildWhere({}), { id }] },
      select: PRODUCT_READ_SELECT,
    });
  }

  async averageRatings(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    const grouped: Array<{
      productId: string | null;
      _avg: { rating: number | null };
    }> = await prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
    });

    return new Map(
      grouped
        .filter((row) => row.productId !== null && row._avg.rating !== null)
        .map((row) => [
          row.productId as string,
          Number(row._avg.rating!.toFixed(2)),
        ]),
    );
  }

  async findActiveSellerByUserId(
    userId: string,
  ): Promise<{ id: string } | null> {
    return prisma.seller.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });
  }

  async findForAuthorization(
    id: string,
  ): Promise<{ id: string; sellerId: string; isActive: boolean } | null> {
    return prisma.product.findUnique({
      where: { id },
      select: { id: true, sellerId: true, isActive: true },
    });
  }

  async createWithInventory(
    data: ProductCreateData,
    initialInventory = { onHandQuantity: 0, reservedQuantity: 0 },
  ): Promise<{ id: string }> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const product = await tx.product.create({
        data: {
          sellerId: data.sellerId,
          name: data.name,
          reference: data.reference,
          description: data.description,
          priceInCents: data.priceInCents,
          currency: data.currency,
          category: data.category,
          image: data.image,
        },
        select: { id: true },
      });

      await tx.inventory.create({
        data: {
          productId: product.id,
          onHandQuantity: initialInventory.onHandQuantity,
          reservedQuantity: initialInventory.reservedQuantity,
        },
      });

      return product;
    });
  }

  async updateProduct(
    id: string,
    data: ProductUpdateData,
  ): Promise<{ id: string }> {
    return prisma.product.update({ where: { id }, data, select: { id: true } });
  }

  async deactivateProduct(
    id: string,
    deactivatedAt: Date,
  ): Promise<{ id: string }> {
    return prisma.product.update({
      where: { id },
      data: { isActive: false, deactivatedAt },
      select: { id: true },
    });
  }

  async getProductsByIds(productIds: string[]): Promise<ProductReadRecord[]> {
    return this.findMany({ ids: productIds }, 0, productIds.length);
  }
}

export const productRepository = new ProductRepository();
