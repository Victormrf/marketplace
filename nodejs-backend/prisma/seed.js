const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("test1234", 10);

  // Admin
  await prisma.user.create({
    data: {
      name: "Admin User",
      email: "vmrf2000@hotmail.com",
      password,
      role: "ADMIN",
    },
  });

  // Customers
  const customers = await Promise.all(
    [1, 2, 3].map(async (i) => {
      const user = await prisma.user.create({
        data: {
          name: `Customer ${i}`,
          email: `customer${i}@email.com`,
          password,
          role: "CUSTOMER",
          Customer: {
            create: {
              address: `Street ${i}`,
              phone: `555-000${i}`,
            },
          },
        },
        include: {
          Customer: true,
        },
      });
      return {
        ...user.Customer,
        userId: user.id,
      };
    })
  );

  // Sellers
  const sellers = await Promise.all(
    [1, 2, 3].map(async (i) => {
      const user = await prisma.user.create({
        data: {
          name: `Seller ${i}`,
          email: `seller${i}@email.com`,
          password,
          role: "SELLER",
          Seller: {
            create: {
              storeName: `Store ${i}`,
              description: `Awesome store ${i}`,
              logo: null,
            },
          },
        },
        include: {
          Seller: true,
        },
      });
      return {
        ...user.Seller,
        storeName: `Store ${i}`,
        userId: user.id,
      };
    })
  );

  // Lista manual de categorias
  const categories = [
    "Office",
    "Sports",
    "Books",
    "Beauty",
    "Clothing",
    "Toys",
    "TvProjectors",
    "SmartphonesTablets",
    "Eletronics",
    "Pets",
    "Furniture",
  ];

  const sellersToUse = Array.from(
    { length: categories.length },
    (_, i) => sellers[i % sellers.length]
  );

  // Produtos
  const products = await Promise.all(
    categories.map((category, index) => {
      return prisma.product.create({
        data: {
          name: `Product ${category}`,
          description: `Descrição do produto de ${category}`,
          price: Math.floor(Math.random() * 1000) + 50,
          stock: 20,
          category,
          sellerId: sellersToUse[index].id,
        },
      });
    })
  );

  const orderStatuses = [
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];

  for (let i = 0; i < orderStatuses.length; i++) {
    const order = await prisma.order.create({
      data: {
        customerId: customers[i % customers.length].id,
        totalPrice: products[i].price,
        status: orderStatuses[i],
        orderItems: {
          create: [
            {
              productId: products[i].id,
              quantity: 1,
              unitPrice: products[i].price,
            },
          ],
        },
        payment: {
          create: {
            amount: products[i].price,
            status: "PAID",
          },
        },
      },
    });
  }

  // Product Reviews
  for (let i = 0; i < products.length; i++) {
    await prisma.review.create({
      data: {
        userId: customers[i % customers.length].userId,
        productId: products[i].id,
        rating: 4,
        comment: `Great product in category ${products[i].category}`,
      },
    });
  }

  // Seller Reviews
  for (let i = 0; i < sellers.length; i++) {
    await prisma.review.create({
      data: {
        userId: customers[i % customers.length].userId,
        sellerId: sellers[i].id,
        rating: 5,
        comment: `Excellent service from ${sellers[i].storeName}`,
      },
    });
  }

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
