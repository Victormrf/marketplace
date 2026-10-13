const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const configPath = path.join(
  __dirname,
  "..",
  "config",
  "scale-profiles.json"
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const profileNames = ["small", "medium", "large"];

function roundedProduct(value, rate) {
  return Math.round(value * rate);
}

function estimateProfile(profile) {
  const { exact, derivation } = profile;
  const sellerOrders = roundedProduct(
    exact.orders,
    derivation.sellerOrdersPerOrderAverage
  );
  const orderItems = roundedProduct(
    sellerOrders,
    derivation.itemsPerSellerOrderAverage
  );
  const cartItems = roundedProduct(
    exact.carts,
    derivation.cartItemsPerCartAverage
  );
  const capturedPaymentAttempts = roundedProduct(
    exact.orders,
    derivation.capturedOrdersRate
  );
  const deliveries = roundedProduct(
    sellerOrders,
    derivation.deliveryCoverageRate
  );
  const inventoryReservations = orderItems;
  const inventoryMovements =
    inventoryReservations +
    exact.products * derivation.additionalInventoryMovementsPerProduct;
  const estimates = {
    users: exact.customers + exact.sellers,
    customerAddresses: roundedProduct(
      exact.customers,
      derivation.addressesPerCustomerAverage
    ),
    inventories: exact.products,
    sellerOrders,
    orderItems,
    cartItems,
    productReviews: roundedProduct(
      exact.orders,
      derivation.productReviewsPerOrderAverage
    ),
    sellerReviews: roundedProduct(
      exact.orders,
      derivation.sellerReviewsPerOrderAverage
    ),
    paymentAttempts: roundedProduct(
      exact.orders,
      derivation.paymentAttemptsPerOrderAverage
    ),
    refunds: roundedProduct(
      capturedPaymentAttempts,
      derivation.refundsPerCapturedAttemptAverage
    ),
    deliveries,
    orderAddresses: exact.orders,
    orderStatusHistories: roundedProduct(
      exact.orders,
      derivation.orderHistoryEntriesPerOrderAverage
    ),
    sellerOrderStatusHistories: roundedProduct(
      sellerOrders,
      derivation.sellerOrderHistoryEntriesPerSellerOrderAverage
    ),
    deliveryStatusHistories: roundedProduct(
      deliveries,
      derivation.deliveryHistoryEntriesPerDeliveryAverage
    ),
    inventoryReservations,
    inventoryMovements,
    idempotencyKeys: roundedProduct(
      exact.orders,
      derivation.idempotencyKeysPerOrder
    ),
  };
  const physicalRows = Object.values(getPhysicalRecordCounts(profile, estimates));

  return {
    estimates,
    totalRows: physicalRows.reduce((total, count) => total + count, 0),
  };
}

function getPhysicalRecordCounts(profile, estimates = profile.estimated) {
  const { exact } = profile;

  return {
    User: estimates.users,
    CustomerProfile: exact.customers,
    CustomerAddress: estimates.customerAddresses,
    Seller: exact.sellers,
    Product: exact.products,
    Inventory: estimates.inventories,
    InventoryReservation: estimates.inventoryReservations,
    InventoryMovement: estimates.inventoryMovements,
    Cart: exact.carts,
    CartItem: estimates.cartItems,
    Order: exact.orders,
    SellerOrder: estimates.sellerOrders,
    OrderItem: estimates.orderItems,
    OrderAddress: estimates.orderAddresses,
    OrderStatusHistory: estimates.orderStatusHistories,
    SellerOrderStatusHistory: estimates.sellerOrderStatusHistories,
    PaymentAttempt: estimates.paymentAttempts,
    Refund: estimates.refunds,
    Delivery: estimates.deliveries,
    DeliveryStatusHistory: estimates.deliveryStatusHistories,
    Review: estimates.productReviews + estimates.sellerReviews,
    IdempotencyKey: estimates.idempotencyKeys,
  };
}

test("declares the three synthetic-data profiles", () => {
  assert.deepEqual(Object.keys(config.profiles).sort(), [...profileNames].sort());
});

test("uses explicit reproducibility values and safe execution limits", () => {
  assert.equal(Number.isInteger(config.randomSeed), true);
  assert.equal(config.baseDateUtc, "2026-01-01T00:00:00.000Z");
  assert.equal(
    new Date(config.baseDateUtc).toISOString(),
    config.baseDateUtc
  );
  assert.equal(config.executionPolicy.databaseName, "marketplace_scale");
  assert.equal(config.executionPolicy.databaseMustBeDedicated, true);
  assert.equal(
    config.executionPolicy.automaticGenerationOnApplicationStartup,
    false
  );
  assert.equal(
    config.executionPolicy.automaticCleanupOnApplicationStartup,
    false
  );
  assert.equal(config.executionPolicy.largeRequiresSmallMeasurement, true);
  assert.equal(config.executionPolicy.largeRequiresExplicitApproval, true);
  assert.equal(config.executionPolicy.storeImageReferencesOnly, true);
  assert.ok(config.executionPolicy.targetStorageBytes >= 5 * 1024 ** 3);
  assert.ok(config.executionPolicy.hardStorageLimitBytes <= 10 * 1024 ** 3);
  assert.ok(
    config.executionPolicy.hardStorageLimitBytes >
      config.executionPolicy.targetStorageBytes
  );
});

test("keeps counts, relation parameters and derived volumes valid", () => {
  for (const name of profileNames) {
    const profile = config.profiles[name];
    const { exact, derivation, estimated, limits } = profile;

    for (const count of Object.values(exact)) {
      assert.ok(Number.isInteger(count) && count > 0, `${name}: exact count`);
    }

    for (const [key, value] of Object.entries(derivation)) {
      assert.ok(Number.isFinite(value) && value >= 0, `${name}: ${key}`);
    }

    assert.ok(exact.carts <= exact.customers);
    assert.ok(derivation.addressesPerCustomerAverage >= 1);
    assert.equal(derivation.idempotencyKeysPerOrder, 1);
    assert.ok(derivation.sellerOrdersPerOrderAverage >= 1);
    assert.ok(derivation.sellerOrdersPerOrderMaximum <= exact.sellers);
    assert.ok(
      derivation.sellerOrdersPerOrderAverage <=
        derivation.sellerOrdersPerOrderMaximum
    );
    assert.ok(derivation.itemsPerSellerOrderAverage >= 1);
    assert.ok(
      derivation.itemsPerSellerOrderAverage <=
        derivation.itemsPerSellerOrderMaximum
    );
    assert.ok(derivation.capturedOrdersRate <= 1);
    assert.ok(derivation.deliveryCoverageRate <= 1);

    const calculated = estimateProfile(profile);

    assert.deepEqual(estimated, calculated.estimates, `${name}: estimates`);
    assert.equal(profile.totalRows, calculated.totalRows, `${name}: total rows`);
    assert.equal(estimated.users, exact.customers + exact.sellers);
    assert.equal(profile.notGenerated.adminUsers.count, 0);
    assert.ok(profile.notGenerated.adminUsers.reason.length > 0);
    assert.equal(estimated.orderAddresses, exact.orders);
    assert.equal(
      estimated.idempotencyKeys,
      exact.orders * derivation.idempotencyKeysPerOrder
    );
    assert.deepEqual(
      Object.keys(getPhysicalRecordCounts(profile)).sort(),
      [
        "Cart",
        "CartItem",
        "CustomerAddress",
        "CustomerProfile",
        "Delivery",
        "DeliveryStatusHistory",
        "IdempotencyKey",
        "Inventory",
        "InventoryMovement",
        "InventoryReservation",
        "Order",
        "OrderAddress",
        "OrderItem",
        "OrderStatusHistory",
        "PaymentAttempt",
        "Product",
        "Refund",
        "Review",
        "Seller",
        "SellerOrder",
        "SellerOrderStatusHistory",
        "User",
      ].sort()
    );
    assert.ok(estimated.sellerOrders <= exact.orders * exact.sellers);
    assert.ok(estimated.orderItems >= estimated.sellerOrders);
    assert.ok(profile.indicators.capturedPaymentAttempts <= estimated.paymentAttempts);
    assert.ok(estimated.refunds <= profile.indicators.capturedPaymentAttempts);
    assert.ok(estimated.deliveries <= estimated.sellerOrders);
    assert.ok(estimated.productReviews <= exact.customers * exact.products);
    assert.ok(estimated.sellerReviews <= exact.customers * exact.sellers);
    assert.ok(estimated.inventoryReservations <= estimated.orderItems);
    assert.ok(profile.totalRows <= limits.maxRecords);
    assert.ok(limits.maxDurationMs <= config.executionPolicy.maxDurationMs);
    assert.ok(limits.estimatedStorageGbHypothesis > 0);
  }
});

test("captured attempts are a subset indicator, not additional rows", () => {
  for (const name of profileNames) {
    const profile = config.profiles[name];
    const initialTotal = Object.values(getPhysicalRecordCounts(profile)).reduce(
      (total, count) => total + count,
      0
    );
    const profileWithMoreCapturedAttempts = {
      ...profile,
      indicators: {
        ...profile.indicators,
        capturedPaymentAttempts: profile.indicators.capturedPaymentAttempts + 1,
      },
    };
    const updatedTotal = Object.values(
      getPhysicalRecordCounts(profileWithMoreCapturedAttempts)
    ).reduce((total, count) => total + count, 0);

    assert.equal(updatedTotal, initialTotal, `${name}: captured subset`);
  }
});

test("scales counts and resource limits monotonically", () => {
  for (let index = 1; index < profileNames.length; index += 1) {
    const previous = config.profiles[profileNames[index - 1]];
    const current = config.profiles[profileNames[index]];

    for (const key of Object.keys(previous.exact)) {
      assert.ok(current.exact[key] > previous.exact[key], `exact.${key}`);
    }

    assert.ok(current.totalRows > previous.totalRows);
    assert.ok(current.limits.maxRecords > previous.limits.maxRecords);
    assert.ok(
      current.limits.estimatedStorageGbHypothesis >
        previous.limits.estimatedStorageGbHypothesis
    );
  }
});
