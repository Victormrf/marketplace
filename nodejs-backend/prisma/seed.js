const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function assertLocalDevelopmentDatabase() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is required for the development seed.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const host = databaseUrl.hostname.toLowerCase();
  const port = databaseUrl.port;
  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));

  if (
    !["localhost", "127.0.0.1"].includes(host) ||
    port !== "5433" ||
    database !== "marketplace_dev"
  ) {
    throw new Error(
      `Refusing seed: expected local PostgreSQL localhost/127.0.0.1:5433/marketplace_dev, received ${host}:${port || "default"}/${database}.`
    );
  }

  console.log(`Seed target confirmed: ${host}:${port}/${database}`);
}

assertLocalDevelopmentDatabase();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const IDS = {
  adminUser: "00000000-0000-0000-0000-000000000001",
  customerUser: "00000000-0000-0000-0000-000000000002",
  sellerOneUser: "00000000-0000-0000-0000-000000000003",
  sellerTwoUser: "00000000-0000-0000-0000-000000000004",
  customer: "00000000-0000-0000-0000-000000000101",
  customerAddress: "00000000-0000-0000-0000-000000000201",
  sellerOne: "00000000-0000-0000-0000-000000000301",
  sellerTwo: "00000000-0000-0000-0000-000000000302",
  productOne: "00000000-0000-0000-0000-000000000401",
  productTwo: "00000000-0000-0000-0000-000000000402",
  productThree: "00000000-0000-0000-0000-000000000403",
  inventoryOne: "00000000-0000-0000-0000-000000000411",
  inventoryTwo: "00000000-0000-0000-0000-000000000412",
  inventoryThree: "00000000-0000-0000-0000-000000000413",
  movementOne: "00000000-0000-0000-0000-000000000421",
  movementTwo: "00000000-0000-0000-0000-000000000422",
  movementThree: "00000000-0000-0000-0000-000000000423",
  cart: "00000000-0000-0000-0000-000000000501",
  cartItemOne: "00000000-0000-0000-0000-000000000511",
  cartItemTwo: "00000000-0000-0000-0000-000000000512",
  order: "00000000-0000-0000-0000-000000000601",
  sellerOrderOne: "00000000-0000-0000-0000-000000000611",
  sellerOrderTwo: "00000000-0000-0000-0000-000000000612",
  orderItemOne: "00000000-0000-0000-0000-000000000621",
  orderItemTwo: "00000000-0000-0000-0000-000000000622",
  orderItemThree: "00000000-0000-0000-0000-000000000623",
  orderAddress: "00000000-0000-0000-0000-000000000631",
  paymentAttempt: "00000000-0000-0000-0000-000000000701",
  deliveryOne: "00000000-0000-0000-0000-000000000801",
  deliveryTwo: "00000000-0000-0000-0000-000000000802",
  orderHistory: "00000000-0000-0000-0000-000000000901",
  sellerOrderHistoryOne: "00000000-0000-0000-0000-000000000911",
  sellerOrderHistoryTwo: "00000000-0000-0000-0000-000000000912",
  deliveryHistoryOne: "00000000-0000-0000-0000-000000000921",
  deliveryHistoryTwo: "00000000-0000-0000-0000-000000000922",
  productReview: "00000000-0000-0000-0000-000000001001",
  sellerReview: "00000000-0000-0000-0000-000000001002",
};

// Development-only credential: dev-seed-password
// The fixed salt makes this hash deterministic and contains no production secret.
const DEV_PASSWORD_HASH = bcrypt.hashSync(
  "dev-seed-password",
  "$2b$10$C6UzMDM.H6dfI/f/IKcEe."
);
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const UPDATED_AT = new Date("2026-01-15T12:00:00.000Z");
const COMPLETED_AT = new Date("2026-01-15T12:30:00.000Z");

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { id: IDS.adminUser },
      update: {
        name: "Development Admin",
        email: "admin.seed@local.invalid",
        normalizedEmail: "admin.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "ADMIN",
        isActive: true,
        deactivatedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.adminUser,
        name: "Development Admin",
        email: "admin.seed@local.invalid",
        normalizedEmail: "admin.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "ADMIN",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    const customerUser = await tx.user.upsert({
      where: { id: IDS.customerUser },
      update: {
        name: "Development Customer",
        email: "customer.seed@local.invalid",
        normalizedEmail: "customer.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "CUSTOMER",
        isActive: true,
        deactivatedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.customerUser,
        name: "Development Customer",
        email: "customer.seed@local.invalid",
        normalizedEmail: "customer.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "CUSTOMER",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    const sellerOneUser = await tx.user.upsert({
      where: { id: IDS.sellerOneUser },
      update: {
        name: "Development Seller One",
        email: "seller.one.seed@local.invalid",
        normalizedEmail: "seller.one.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "SELLER",
        isActive: true,
        deactivatedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerOneUser,
        name: "Development Seller One",
        email: "seller.one.seed@local.invalid",
        normalizedEmail: "seller.one.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "SELLER",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    const sellerTwoUser = await tx.user.upsert({
      where: { id: IDS.sellerTwoUser },
      update: {
        name: "Development Seller Two",
        email: "seller.two.seed@local.invalid",
        normalizedEmail: "seller.two.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "SELLER",
        isActive: true,
        deactivatedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerTwoUser,
        name: "Development Seller Two",
        email: "seller.two.seed@local.invalid",
        normalizedEmail: "seller.two.seed@local.invalid",
        password: DEV_PASSWORD_HASH,
        role: "SELLER",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.customerProfile.upsert({
      where: { id: IDS.customer },
      update: { userId: customerUser.id, phone: "+5511999990001", updatedAt: UPDATED_AT },
      create: {
        id: IDS.customer,
        userId: customerUser.id,
        phone: "+5511999990001",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.customerAddress.upsert({
      where: { id: IDS.customerAddress },
      update: {
        customerId: IDS.customer,
        recipientName: "Development Customer",
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1000",
        complement: "Apto 101",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        countryCode: "BR",
        phone: "+5511999990001",
        isDefault: true,
        isActive: true,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.customerAddress,
        customerId: IDS.customer,
        recipientName: "Development Customer",
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1000",
        complement: "Apto 101",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        countryCode: "BR",
        phone: "+5511999990001",
        isDefault: true,
        isActive: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.seller.upsert({
      where: { id: IDS.sellerOne },
      update: {
        userId: sellerOneUser.id,
        storeName: "Development Store One",
        description: "Deterministic local development seller one.",
        isActive: true,
        deactivatedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerOne,
        userId: sellerOneUser.id,
        storeName: "Development Store One",
        description: "Deterministic local development seller one.",
        isActive: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.seller.upsert({
      where: { id: IDS.sellerTwo },
      update: {
        userId: sellerTwoUser.id,
        storeName: "Development Store Two",
        description: "Deterministic local development seller two.",
        isActive: true,
        deactivatedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerTwo,
        userId: sellerTwoUser.id,
        storeName: "Development Store Two",
        description: "Deterministic local development seller two.",
        isActive: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    const products = [
      {
        id: IDS.productOne,
        sellerId: IDS.sellerOne,
        name: "Development Office Pack",
        reference: "DEV-OFFICE-001",
        description: "Fixed-price office product for local development.",
        priceInCents: 1250,
        category: "OFFICE",
        inventoryId: IDS.inventoryOne,
        movementId: IDS.movementOne,
        onHandQuantity: 10,
      },
      {
        id: IDS.productTwo,
        sellerId: IDS.sellerOne,
        name: "Development Sports Bottle",
        reference: "DEV-SPORTS-001",
        description: "Fixed-price sports product for local development.",
        priceInCents: 800,
        category: "SPORTS",
        inventoryId: IDS.inventoryTwo,
        movementId: IDS.movementTwo,
        onHandQuantity: 8,
      },
      {
        id: IDS.productThree,
        sellerId: IDS.sellerTwo,
        name: "Development Book",
        reference: "DEV-BOOKS-001",
        description: "Fixed-price books product for local development.",
        priceInCents: 2200,
        category: "BOOKS",
        inventoryId: IDS.inventoryThree,
        movementId: IDS.movementThree,
        onHandQuantity: 6,
      },
    ];

    for (const product of products) {
      await tx.product.upsert({
        where: { id: product.id },
        update: {
          sellerId: product.sellerId,
          name: product.name,
          reference: product.reference,
          description: product.description,
          priceInCents: product.priceInCents,
          currency: "BRL",
          category: product.category,
          isActive: true,
          deactivatedAt: null,
          updatedAt: UPDATED_AT,
        },
        create: {
          id: product.id,
          sellerId: product.sellerId,
          name: product.name,
          reference: product.reference,
          description: product.description,
          priceInCents: product.priceInCents,
          currency: "BRL",
          category: product.category,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        },
      });

      await tx.inventory.upsert({
        where: { id: product.inventoryId },
        update: {
          productId: product.id,
          onHandQuantity: product.onHandQuantity,
          reservedQuantity: 0,
          updatedAt: UPDATED_AT,
        },
        create: {
          id: product.inventoryId,
          productId: product.id,
          onHandQuantity: product.onHandQuantity,
          reservedQuantity: 0,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        },
      });

      await tx.inventoryMovement.upsert({
        where: { id: product.movementId },
        update: {
          inventoryId: product.inventoryId,
          movementType: "RESTOCK",
          onHandDelta: product.onHandQuantity,
          reservedDelta: 0,
          onHandAfter: product.onHandQuantity,
          reservedAfter: 0,
          reason: "Initial deterministic development stock.",
        },
        create: {
          id: product.movementId,
          inventoryId: product.inventoryId,
          movementType: "RESTOCK",
          onHandDelta: product.onHandQuantity,
          reservedDelta: 0,
          onHandAfter: product.onHandQuantity,
          reservedAfter: 0,
          reason: "Initial deterministic development stock.",
          createdAt: CREATED_AT,
        },
      });
    }

    await tx.cart.upsert({
      where: { id: IDS.cart },
      update: {
        customerId: IDS.customer,
        status: "ACTIVE",
        convertedAt: null,
        abandonedAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.cart,
        customerId: IDS.customer,
        status: "ACTIVE",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.cartItem.upsert({
      where: { id: IDS.cartItemOne },
      update: { cartId: IDS.cart, productId: IDS.productOne, quantity: 2, updatedAt: UPDATED_AT },
      create: {
        id: IDS.cartItemOne,
        cartId: IDS.cart,
        productId: IDS.productOne,
        quantity: 2,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.cartItem.upsert({
      where: { id: IDS.cartItemTwo },
      update: { cartId: IDS.cart, productId: IDS.productThree, quantity: 1, updatedAt: UPDATED_AT },
      create: {
        id: IDS.cartItemTwo,
        cartId: IDS.cart,
        productId: IDS.productThree,
        quantity: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.order.upsert({
      where: { id: IDS.order },
      update: {
        customerId: IDS.customer,
        status: "COMPLETED",
        subtotalInCents: 5500,
        shippingInCents: 900,
        taxInCents: 500,
        discountInCents: 100,
        totalInCents: 6800,
        currency: "BRL",
        confirmedAt: COMPLETED_AT,
        completedAt: COMPLETED_AT,
        cancelledAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.order,
        customerId: IDS.customer,
        status: "COMPLETED",
        subtotalInCents: 5500,
        shippingInCents: 900,
        taxInCents: 500,
        discountInCents: 100,
        totalInCents: 6800,
        currency: "BRL",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        confirmedAt: COMPLETED_AT,
        completedAt: COMPLETED_AT,
      },
    });

    await tx.sellerOrder.upsert({
      where: { id: IDS.sellerOrderOne },
      update: {
        orderId: IDS.order,
        sellerId: IDS.sellerOne,
        status: "DELIVERED",
        subtotalInCents: 3300,
        shippingInCents: 500,
        taxInCents: 300,
        discountInCents: 100,
        totalInCents: 4000,
        currency: "BRL",
        confirmedAt: COMPLETED_AT,
        completedAt: COMPLETED_AT,
        cancelledAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerOrderOne,
        orderId: IDS.order,
        sellerId: IDS.sellerOne,
        status: "DELIVERED",
        subtotalInCents: 3300,
        shippingInCents: 500,
        taxInCents: 300,
        discountInCents: 100,
        totalInCents: 4000,
        currency: "BRL",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        confirmedAt: COMPLETED_AT,
        completedAt: COMPLETED_AT,
      },
    });

    await tx.sellerOrder.upsert({
      where: { id: IDS.sellerOrderTwo },
      update: {
        orderId: IDS.order,
        sellerId: IDS.sellerTwo,
        status: "DELIVERED",
        subtotalInCents: 2200,
        shippingInCents: 400,
        taxInCents: 200,
        discountInCents: 0,
        totalInCents: 2800,
        currency: "BRL",
        confirmedAt: COMPLETED_AT,
        completedAt: COMPLETED_AT,
        cancelledAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerOrderTwo,
        orderId: IDS.order,
        sellerId: IDS.sellerTwo,
        status: "DELIVERED",
        subtotalInCents: 2200,
        shippingInCents: 400,
        taxInCents: 200,
        discountInCents: 0,
        totalInCents: 2800,
        currency: "BRL",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        confirmedAt: COMPLETED_AT,
        completedAt: COMPLETED_AT,
      },
    });

    const orderItems = [
      {
        id: IDS.orderItemOne,
        sellerOrderId: IDS.sellerOrderOne,
        productId: IDS.productOne,
        quantity: 2,
        unitPriceInCents: 1250,
        lineTotalInCents: 2500,
        productNameSnapshot: "Development Office Pack",
        productReferenceSnapshot: "DEV-OFFICE-001",
        sellerNameSnapshot: "Development Store One",
      },
      {
        id: IDS.orderItemTwo,
        sellerOrderId: IDS.sellerOrderOne,
        productId: IDS.productTwo,
        quantity: 1,
        unitPriceInCents: 800,
        lineTotalInCents: 800,
        productNameSnapshot: "Development Sports Bottle",
        productReferenceSnapshot: "DEV-SPORTS-001",
        sellerNameSnapshot: "Development Store One",
      },
      {
        id: IDS.orderItemThree,
        sellerOrderId: IDS.sellerOrderTwo,
        productId: IDS.productThree,
        quantity: 1,
        unitPriceInCents: 2200,
        lineTotalInCents: 2200,
        productNameSnapshot: "Development Book",
        productReferenceSnapshot: "DEV-BOOKS-001",
        sellerNameSnapshot: "Development Store Two",
      },
    ];

    for (const item of orderItems) {
      await tx.orderItem.upsert({
        where: { id: item.id },
        update: {
          sellerOrderId: item.sellerOrderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceInCents: item.unitPriceInCents,
          lineTotalInCents: item.lineTotalInCents,
          currency: "BRL",
          productNameSnapshot: item.productNameSnapshot,
          productReferenceSnapshot: item.productReferenceSnapshot,
          sellerNameSnapshot: item.sellerNameSnapshot,
        },
        create: {
          ...item,
          currency: "BRL",
          createdAt: CREATED_AT,
        },
      });
    }

    await tx.orderAddress.upsert({
      where: { id: IDS.orderAddress },
      update: {
        orderId: IDS.order,
        sourceAddressId: IDS.customerAddress,
        recipientName: "Development Customer",
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1000",
        complement: "Apto 101",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        countryCode: "BR",
        phone: "+5511999990001",
      },
      create: {
        id: IDS.orderAddress,
        orderId: IDS.order,
        sourceAddressId: IDS.customerAddress,
        recipientName: "Development Customer",
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1000",
        complement: "Apto 101",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        countryCode: "BR",
        phone: "+5511999990001",
        createdAt: CREATED_AT,
      },
    });

    await tx.paymentAttempt.upsert({
      where: { id: IDS.paymentAttempt },
      update: {
        orderId: IDS.order,
        provider: "development_provider",
        providerReference: "dev-payment-0001",
        method: "PIX",
        status: "CAPTURED",
        amountInCents: 6800,
        currency: "BRL",
        failureCode: null,
        failureMessage: null,
        metadata: { environment: "local", deterministic: true },
        authorizedAt: COMPLETED_AT,
        capturedAt: COMPLETED_AT,
        failedAt: null,
        cancelledAt: null,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.paymentAttempt,
        orderId: IDS.order,
        provider: "development_provider",
        providerReference: "dev-payment-0001",
        method: "PIX",
        status: "CAPTURED",
        amountInCents: 6800,
        currency: "BRL",
        metadata: { environment: "local", deterministic: true },
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        authorizedAt: COMPLETED_AT,
        capturedAt: COMPLETED_AT,
      },
    });

    await tx.delivery.upsert({
      where: { id: IDS.deliveryOne },
      update: {
        sellerOrderId: IDS.sellerOrderOne,
        trackingCode: "DEV-TRACK-0001",
        carrier: "Development Carrier",
        status: "DELIVERED",
        estimatedDelivery: COMPLETED_AT,
        deliveredAt: COMPLETED_AT,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.deliveryOne,
        sellerOrderId: IDS.sellerOrderOne,
        trackingCode: "DEV-TRACK-0001",
        carrier: "Development Carrier",
        status: "DELIVERED",
        estimatedDelivery: COMPLETED_AT,
        deliveredAt: COMPLETED_AT,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.delivery.upsert({
      where: { id: IDS.deliveryTwo },
      update: {
        sellerOrderId: IDS.sellerOrderTwo,
        trackingCode: "DEV-TRACK-0002",
        carrier: "Development Carrier",
        status: "DELIVERED",
        estimatedDelivery: COMPLETED_AT,
        deliveredAt: COMPLETED_AT,
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.deliveryTwo,
        sellerOrderId: IDS.sellerOrderTwo,
        trackingCode: "DEV-TRACK-0002",
        carrier: "Development Carrier",
        status: "DELIVERED",
        estimatedDelivery: COMPLETED_AT,
        deliveredAt: COMPLETED_AT,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.orderStatusHistory.upsert({
      where: { id: IDS.orderHistory },
      update: { orderId: IDS.order, fromStatus: null, toStatus: "COMPLETED", reason: "Initial development order state." },
      create: {
        id: IDS.orderHistory,
        orderId: IDS.order,
        fromStatus: null,
        toStatus: "COMPLETED",
        reason: "Initial development order state.",
        createdAt: COMPLETED_AT,
      },
    });

    for (const [id, sellerOrderId] of [
      [IDS.sellerOrderHistoryOne, IDS.sellerOrderOne],
      [IDS.sellerOrderHistoryTwo, IDS.sellerOrderTwo],
    ]) {
      await tx.sellerOrderStatusHistory.upsert({
        where: { id },
        update: { sellerOrderId, fromStatus: null, toStatus: "DELIVERED", reason: "Initial development seller-order state." },
        create: {
          id,
          sellerOrderId,
          fromStatus: null,
          toStatus: "DELIVERED",
          reason: "Initial development seller-order state.",
          createdAt: COMPLETED_AT,
        },
      });
    }

    for (const [id, deliveryId, trackingCode] of [
      [IDS.deliveryHistoryOne, IDS.deliveryOne, "DEV-TRACK-0001"],
      [IDS.deliveryHistoryTwo, IDS.deliveryTwo, "DEV-TRACK-0002"],
    ]) {
      await tx.deliveryStatusHistory.upsert({
        where: { id },
        update: { deliveryId, fromStatus: null, toStatus: "DELIVERED", reason: `Initial delivery ${trackingCode}.` },
        create: {
          id,
          deliveryId,
          fromStatus: null,
          toStatus: "DELIVERED",
          reason: `Initial delivery ${trackingCode}.`,
          changedAt: COMPLETED_AT,
        },
      });
    }

    await tx.review.upsert({
      where: { id: IDS.productReview },
      update: {
        userId: IDS.customerUser,
        productId: IDS.productOne,
        sellerId: null,
        rating: 5,
        comment: "Deterministic product review.",
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.productReview,
        userId: IDS.customerUser,
        productId: IDS.productOne,
        rating: 5,
        comment: "Deterministic product review.",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    await tx.review.upsert({
      where: { id: IDS.sellerReview },
      update: {
        userId: IDS.customerUser,
        productId: null,
        sellerId: IDS.sellerTwo,
        rating: 4,
        comment: "Deterministic seller review.",
        updatedAt: UPDATED_AT,
      },
      create: {
        id: IDS.sellerReview,
        userId: IDS.customerUser,
        sellerId: IDS.sellerTwo,
        rating: 4,
        comment: "Deterministic seller review.",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    return {
      users: [admin.id, customerUser.id, sellerOneUser.id, sellerTwoUser.id],
      orderId: IDS.order,
    };
  });

  console.log(`Seed completed: order=${result.orderId}, users=${result.users.length}`);
}

main()
  .catch((error) => {
    console.error("Development seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
