const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function assertLocalDevelopmentDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the seed cleaner");
  }

  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");

  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    databaseName !== "marketplace_dev"
  ) {
    throw new Error(
      "seedCleaner is restricted to localhost:5433/marketplace_dev",
    );
  }
}

async function main() {
  assertLocalDevelopmentDatabase();

  const prisma = new PrismaClient();

  try {
    await prisma.review.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.deliveryStatusHistory.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.inventoryReservation.deleteMany();
    await prisma.orderAddress.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.sellerOrderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.sellerOrder.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.customerAddress.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.seller.deleteMany();
    await prisma.customerProfile.deleteMany();
    await prisma.user.deleteMany();

    console.log("Database cleared successfully!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error clearing the database:", error);
  process.exit(1);
});
