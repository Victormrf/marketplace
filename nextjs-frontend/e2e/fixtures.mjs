import { createRequire } from "node:module";
import { test as base, expect } from "@playwright/test";
import environment from "./environment.cjs";

const { DATABASE_URL, backendDirectory, assertTestDatabase } = environment;
assertTestDatabase(process.env.DATABASE_URL ?? DATABASE_URL);
process.env.DATABASE_URL = DATABASE_URL;
const requireBackend = createRequire(`${backendDirectory}/package.json`);
const { PrismaClient } = requireBackend("@prisma/client");
const bcrypt = requireBackend("bcrypt");

export const password = "e2e-fixture-password";
export const id = (number) =>
  `e2000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const ids = {
  customerUser: id(1),
  sellerUser: id(2),
  otherSellerUser: id(3),
  customer: id(10),
  seller: id(20),
  otherSeller: id(21),
  product: id(30),
  unavailableProduct: id(33),
  address: id(40),
  secondAddress: id(41),
  order: id(50),
  sellerOrder: id(51),
};

const entitiesInDeletionOrder = [
  "review",
  "refund",
  "paymentAttempt",
  "deliveryStatusHistory",
  "delivery",
  "inventoryMovement",
  "inventoryReservation",
  "orderAddress",
  "orderStatusHistory",
  "sellerOrderStatusHistory",
  "orderItem",
  "cartItem",
  "idempotencyKey",
  "sellerOrder",
  "order",
  "cart",
  "customerAddress",
  "inventory",
  "product",
  "seller",
  "customerProfile",
  "user",
];

async function cleanDatabase(db) {
  assertTestDatabase(process.env.DATABASE_URL);
  const [identity] = await db.$queryRaw`
    SELECT current_database() AS database, current_user AS username
  `;
  if (
    identity.database !== "marketplace_e2e" ||
    identity.username !== "marketplace_e2e"
  ) {
    throw new Error(
      "E2E refused: connected database identity is not authorized",
    );
  }
  await db.$transaction(async (tx) => {
    for (const entity of entitiesInDeletionOrder) {
      await tx[entity].deleteMany();
    }
  });
  for (const entity of entitiesInDeletionOrder) {
    expect(await db[entity].count(), `${entity} cleanup`).toBe(0);
  }
}

async function prepareFixtures(db) {
  const hash = await bcrypt.hash(password, 4);
  await db.user.createMany({
    data: [
      {
        id: ids.customerUser,
        name: "E2E Customer",
        email: "customer@e2e.local.invalid",
        normalizedEmail: "customer@e2e.local.invalid",
        password: hash,
        role: "CUSTOMER",
      },
      {
        id: ids.sellerUser,
        name: "E2E Seller",
        email: "seller@e2e.local.invalid",
        normalizedEmail: "seller@e2e.local.invalid",
        password: hash,
        role: "SELLER",
      },
      {
        id: ids.otherSellerUser,
        name: "E2E Other Seller",
        email: "other-seller@e2e.local.invalid",
        normalizedEmail: "other-seller@e2e.local.invalid",
        password: hash,
        role: "SELLER",
      },
    ],
  });
  await db.customerProfile.create({
    data: { id: ids.customer, userId: ids.customerUser, phone: "11999990000" },
  });
  await db.seller.createMany({
    data: [
      { id: ids.seller, userId: ids.sellerUser, storeName: "E2E Store" },
      {
        id: ids.otherSeller,
        userId: ids.otherSellerUser,
        storeName: "E2E Other Store",
      },
    ],
  });
  for (let index = 0; index < 5; index += 1) {
    await db.product.create({
      data: {
        id: id(30 + index),
        sellerId: index === 4 ? ids.otherSeller : ids.seller,
        name: `E2E Book ${index + 1}`,
        reference: `E2E-BOOK-${index + 1}`,
        category: "BOOKS",
        priceInCents: 2500,
        currency: "BRL",
        createdAt: new Date(`2026-01-0${index + 1}T12:00:00Z`),
        inventory: { create: { onHandQuantity: index === 3 ? 0 : 5 } },
      },
    });
  }
  await db.customerAddress.createMany({
    data: [ids.address, ids.secondAddress].map((addressId, index) => ({
      id: addressId,
      customerId: ids.customer,
      recipientName: `E2E Recipient ${index + 1}`,
      postalCode: "01001000",
      street: "E2E Street",
      number: String(100 + index),
      neighborhood: "E2E Neighborhood",
      city: "São Paulo",
      state: "SP",
      countryCode: "BR",
      isDefault: index === 0,
    })),
  });
  await db.order.create({
    data: {
      id: ids.order,
      customerId: ids.customer,
      status: "CONFIRMED",
      subtotalInCents: 2500,
      totalInCents: 2500,
      confirmedAt: new Date(),
      sellerOrders: {
        create: {
          id: ids.sellerOrder,
          sellerId: ids.seller,
          subtotalInCents: 2500,
          totalInCents: 2500,
          currency: "BRL",
          items: {
            create: {
              productId: ids.product,
              quantity: 1,
              unitPriceInCents: 2500,
              lineTotalInCents: 2500,
              currency: "BRL",
              productNameSnapshot: "E2E Book 1",
              sellerNameSnapshot: "E2E Store",
            },
          },
        },
      },
    },
  });
}

export const test = base.extend({
  database: [
    async ({}, use) => {
      const db = new PrismaClient({
        datasources: { db: { url: DATABASE_URL } },
      });
      try {
        await cleanDatabase(db);
        await prepareFixtures(db);
        await use(db);
      } finally {
        await cleanDatabase(db);
        await db.$disconnect();
      }
    },
    { auto: true },
  ],
});

export { expect };

export async function login(page, role = "customer") {
  await page.goto("/login?returnTo=%2Fprofile");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`${role}@e2e.local.invalid`);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Entrar", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByText(`${role}@e2e.local.invalid`, { exact: true }),
  ).toBeVisible();
}

export async function addProduct(page) {
  await page.goto("/products?search=E2E%20Book%201");
  await page.getByRole("heading", { name: "E2E Book 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await expect(
    page.getByText("Produto adicionado ao carrinho.", { exact: true }),
  ).toBeVisible();
}

export async function checkout(page) {
  await addProduct(page);
  await page.goto("/cart/checkout");
  await page.getByRole("radio", { name: /E2E Recipient 2/ }).check();
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+$/);
  return page.url().split("/").at(-1);
}

export async function captureViaSimulatedCallback(attemptId) {
  // A provider event is not a customer HTTP operation; use existing transaction rules.
  const { PaymentService } = requireBackend(
    "./dist/services/paymentService.js",
  );
  const prisma = requireBackend("./dist/config/db.js").default;
  try {
    const service = new PaymentService();
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    expect(attempt.provider).toBe("DEV_SIMULATOR");
    await service.startProcessing(attemptId);
    await service.authorize(attemptId, attempt.providerReference);
    await service.capture(attemptId);
  } finally {
    await prisma.$disconnect();
  }
}
