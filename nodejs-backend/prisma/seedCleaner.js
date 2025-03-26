const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Deleting all products first to avoid foreign key constraints when deleting the seller
  await prisma.product.deleteMany();

  // Delete the seller records
  await prisma.seller.deleteMany();

  // Delete users
  await prisma.user.deleteMany();

  console.log("Database cleared successfully!");
}

main()
  .catch((e) => {
    console.error("Error clearing the database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
