const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Ordem correta para deletar evitando violação de chave estrangeira
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order_item.deleteMany();
  await prisma.cart_item.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.customer.deleteMany();
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
