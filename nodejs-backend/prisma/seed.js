const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create users and store the inserted users
  const alice = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@example.com",
      password: "test123",
      role: "customer",
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob",
      email: "bob@example.com",
      password: "test123",
      role: "seller",
    },
  });

  // Create customer using Alice's userId
  const aliceCustomer = await prisma.customer.create({
    data: {
      userId: alice.id,
      address: "wonderland, rainbow road, number 123",
      phone: "+55 (32) 98765-4321",
    },
  });

  // Create seller using Bob's userId
  const bobSeller = await prisma.seller.create({
    data: {
      userId: bob.id,
      storeName: "Fake Store",
      description: "This is a fake description",
      rating: 4.4,
    },
  });

  // Create products using Bob's sellerId
  await prisma.product.createMany({
    data: [
      {
        name: "Laptop",
        price: 1200.0,
        sellerId: bobSeller.id,
        stock: 2,
        category: "tech",
      },
      {
        name: "Phone",
        price: 800.0,
        sellerId: bobSeller.id,
        stock: 3,
        category: "tech",
      },
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
