const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const config = require("../config/scale-profiles.json");
const {
  allocateQuotas,
  planSellerOrderScenarios,
} = require("./helpers/scale-planning");

const distributions = config.distributions;
const schema = fs.readFileSync(
  path.join(__dirname, "..", "prisma", "schema.prisma"),
  "utf8"
);

function assertShares(shares) {
  const values = Object.values(shares);

  for (const value of values) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }

  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
}

function enumValues(name) {
  const body = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];

  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z_]+$/.test(line));
}

function assertPath(statuses, transitions) {
  for (let index = 1; index < statuses.length; index += 1) {
    assert.ok(
      transitions[statuses[index - 1]].includes(statuses[index]),
      `${statuses[index - 1]} -> ${statuses[index]}`
    );
  }
}

test("final-state shares, event probability and references are explicit", () => {
  const stateGroups = [
    [distributions.carts.finalStates, "CartStatus"],
    [
      distributions.orders.scenarios.unpaid.paymentFinalStates,
      "PaymentAttemptStatus",
    ],
    [
      distributions.events.paymentRetries.priorAttemptFinalStates,
      "PaymentAttemptStatus",
    ],
    [distributions.refunds.finalStates, "RefundStatus"],
  ];

  for (const [shares, enumName] of stateGroups) {
    assertShares(shares);
    assert.ok(
      Object.keys(shares).every((value) => enumValues(enumName).includes(value))
    );
  }

  assertShares(distributions.customerPurchases.finalCategories);
  assertShares(distributions.inventory.finalCategories);
  assertShares(distributions.reviews.ratings);
  assert.deepEqual(
    Object.keys(distributions.reviews.ratings),
    ["1", "2", "3", "4", "5"]
  );
  assertShares(
    Object.fromEntries(
      Object.entries(distributions.sellerOrders.scenarios).map(([name, value]) => {
        return [name, value.share];
      })
    )
  );
  const bases = {
    sellerConcentration: "sellers",
    productPopularity: "products-per-seller",
    customerPurchases: "customers",
    carts: "carts",
    orders: "orders",
    sellerOrders: "paidSellerOrders",
    inventory: "products",
    refunds: "capturedPaymentAttempts",
    reviews: "deliveredSellerOrders",
    chronology: "baseDateUtc",
  };

  for (const [group, base] of Object.entries(bases)) {
    assert.equal(distributions[group].base, base);
  }

  assert.equal(distributions.events.paymentRetries.base, "extraPaymentAttempts");
  assert.equal(distributions.events.checkoutReplay.base, "orders");
  assert.ok(distributions.events.checkoutReplay.probability >= 0);
  assert.ok(distributions.events.checkoutReplay.probability <= 1);
  assert.equal(distributions.events.checkoutReplay.additionalPhysicalRows, 0);

  for (const profile of Object.values(config.profiles)) {
    for (const parameter of [
      distributions.orders.paidFractionParameter,
      distributions.refunds.countParameter,
      distributions.reviews.productCountParameter,
      distributions.reviews.sellerCountParameter,
    ]) {
      assert.ok(Object.hasOwn(profile.derivation, parameter));
    }
  }
});

test("related states come from compatible paths, with historical seller states explicit", () => {
  const paymentTransitions = {
    CREATED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["AUTHORIZED", "FAILED", "CANCELLED"],
    AUTHORIZED: ["CAPTURED", "FAILED", "CANCELLED"],
    CAPTURED: [],
    FAILED: [],
    CANCELLED: [],
  };
  const deliveryTransitions = {
    SEPARATED: ["PROCESSING", "FAILED"],
    PROCESSING: ["SHIPPED", "FAILED"],
    SHIPPED: ["COLLECTED", "FAILED"],
    COLLECTED: ["ARRIVED_AT_CENTER", "FAILED"],
    ARRIVED_AT_CENTER: ["DELIVERED", "FAILED"],
    DELIVERED: ["RETURNED"],
    FAILED: ["RETURNED"],
    RETURNED: [],
  };
  const historicalSellerTransitions = {
    PENDING: ["CONFIRMED"],
    CONFIRMED: ["PROCESSING"],
    PROCESSING: ["SHIPPED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["RETURNED"],
    RETURNED: [],
  };

  assert.deepEqual(distributions.orders.scenarios.paid.orderPath, [
    "PENDING_PAYMENT",
    "CONFIRMED",
  ]);
  assert.deepEqual(distributions.orders.scenarios.unpaid.orderPath, ["PENDING_PAYMENT"]);
  assert.deepEqual(distributions.orders.scenarios.unpaid.sellerOrderPath, ["PENDING"]);
  assertPath(distributions.orders.scenarios.paid.paymentPath, paymentTransitions);

  for (const [finalStatus, paymentPath] of Object.entries(
    distributions.orders.paymentPaths
  )) {
    assert.equal(paymentPath[0], "CREATED");
    assert.equal(paymentPath.at(-1), finalStatus);
    assertPath(paymentPath, paymentTransitions);
  }

  assert.deepEqual(
    distributions.orders.scenarios.paid.paymentPath,
    distributions.orders.paymentPaths.CAPTURED
  );

  for (const scenario of Object.values(distributions.sellerOrders.scenarios)) {
    assert.equal(scenario.sellerOrderPath[0], "PENDING");
    assertPath(scenario.sellerOrderPath, historicalSellerTransitions);
    assertPath(scenario.deliveryPath, deliveryTransitions);

    if (scenario.deliveryPath.length > 0) {
      assert.equal(scenario.deliveryPath[0], "SEPARATED");
      assert.ok(scenario.sellerOrderPath.includes("CONFIRMED"));
    }

    if (scenario.sellerOrderPath.at(-1) === "DELIVERED") {
      assert.equal(scenario.deliveryPath.at(-1), "DELIVERED");
    }

    if (scenario.sellerOrderPath.at(-1) === "RETURNED") {
      assert.equal(scenario.deliveryPath.at(-1), "RETURNED");
    }
  }

  assert.equal(distributions.relationships.historicalSellerOrderSnapshots, true);
  assert.equal(distributions.relationships.automaticOrderSellerOrderDeliverySync, false);
  assert.equal(distributions.relationships.automaticReservationCommitOrRelease, false);
});

test("concentration, repeated purchases and cart quotas fit every profile", () => {
  const concentration = distributions.sellerConcentration;
  const popularity = distributions.productPopularity;

  for (const value of [
    concentration.leadingSellerFraction,
    concentration.productShare,
    concentration.sellerOrderShare,
    popularity.popularFraction,
    popularity.orderItemShare,
  ]) {
    assert.ok(value > 0 && value < 1);
  }

  for (const profile of Object.values(config.profiles)) {
    const { exact, estimated, derivation } = profile;
    const leaders = Math.ceil(exact.sellers * concentration.leadingSellerFraction);
    const others = exact.sellers - leaders;
    const leaderProducts = Math.round(exact.products * concentration.productShare);
    const leaderSales = Math.round(
      estimated.sellerOrders * concentration.sellerOrderShare
    );
    const smallestCatalog = Math.min(
      Math.floor(leaderProducts / leaders),
      Math.floor((exact.products - leaderProducts) / others)
    );

    assert.ok(leaders >= 1 && others >= 1);
    assert.ok(leaderSales <= exact.orders * leaders);
    assert.ok(estimated.sellerOrders - leaderSales <= exact.orders * others);
    assert.ok(smallestCatalog >= derivation.itemsPerSellerOrderMaximum);
    assert.ok(
      Math.ceil(smallestCatalog * popularity.popularFraction) >=
        Math.ceil(derivation.itemsPerSellerOrderAverage * popularity.orderItemShare)
    );
    assert.ok(
      Math.floor(smallestCatalog * distributions.inventory.finalCategories.reserved) >=
        derivation.itemsPerSellerOrderMaximum
    );
    const buyers = allocateQuotas(
      exact.customers,
      distributions.customerPurchases.finalCategories
    );
    const carts = allocateQuotas(exact.carts, distributions.carts.finalStates);

    assert.ok(exact.orders - buyers.single >= buyers.repeat * 2);
    assert.ok(carts.ACTIVE <= exact.customers);
    assert.equal(carts.CONVERTED, 0);
  }
});

test("scenario counts support payment retries, delivered reviews and physical limits", () => {
  for (const profile of Object.values(config.profiles)) {
    const plan = planSellerOrderScenarios(profile, distributions);
    const paidOrders = profile.indicators.capturedPaymentAttempts;
    const unpaidOrders = profile.exact.orders - paidOrders;
    const unpaidSellerOrders = profile.estimated.sellerOrders - plan.paidSellerOrders;
    const extraAttempts = profile.estimated.paymentAttempts - profile.exact.orders;
    const unpaidPayments = allocateQuotas(
      unpaidOrders,
      distributions.orders.scenarios.unpaid.paymentFinalStates
    );
    const retries = allocateQuotas(
      extraAttempts,
      distributions.events.paymentRetries.priorAttemptFinalStates
    );

    assert.equal(
      paidOrders + Object.values(unpaidPayments).reduce((sum, count) => sum + count, 0) +
        Object.values(retries).reduce((sum, count) => sum + count, 0),
      profile.estimated.paymentAttempts
    );
    assert.ok(
      unpaidPayments.CREATED + unpaidPayments.PROCESSING +
        unpaidPayments.AUTHORIZED <= unpaidOrders
    );

    assert.ok(plan.paidSellerOrders >= paidOrders);
    assert.ok(unpaidSellerOrders >= unpaidOrders);
    assert.ok(
      plan.paidSellerOrders <= paidOrders * profile.derivation.sellerOrdersPerOrderMaximum
    );
    assert.ok(extraAttempts >= 0 && extraAttempts <= paidOrders);
    assert.equal(distributions.events.paymentRetries.eligibleOrderScenario, "paid");
    assert.equal(distributions.events.paymentRetries.maximumPerOrder, 1);
    assert.equal(plan.deliveries, profile.estimated.deliveries);
    assert.equal(
      plan.sellerOrderStatusHistories,
      profile.estimated.sellerOrderStatusHistories
    );
    assert.equal(
      plan.deliveryStatusHistories,
      profile.estimated.deliveryStatusHistories
    );
    assert.ok(profile.estimated.sellerReviews <= plan.quotas.delivered);
    assert.ok(profile.estimated.productReviews <= plan.quotas.delivered);
    assert.ok(
      profile.estimated.refunds <= paidOrders * distributions.refunds.maximumPerPayment
    );
    assert.ok(profile.totalRows <= profile.limits.maxRecords);
  }
});

test("rounding preserves totals, supports tiny groups and has a stable tie break", () => {
  assert.deepEqual(allocateQuotas(1, { first: 0.5, second: 0.5, absent: 0 }), {
    first: 1,
    second: 0,
    absent: 0,
  });
  assert.deepEqual(allocateQuotas(0, { first: 0.5, second: 0.5 }), {
    first: 0,
    second: 0,
  });

  for (const total of [1, 3, 7, 40, 980]) {
    const quotas = allocateQuotas(total, distributions.refunds.finalStates);

    assert.equal(
      Object.values(quotas).reduce((sum, count) => sum + count, 0),
      total
    );
    assert.ok(
      Object.values(quotas).every((count) => Number.isInteger(count) && count >= 0)
    );
  }
});

test("financial, inventory and chronology rules preserve required relationships", () => {
  assert.ok(distributions.refunds.maximumAmountFractionPerRefund > 0);
  assert.ok(distributions.refunds.maximumAmountFractionPerRefund <= 1);
  assert.ok(
    distributions.refunds.maximumPerPayment *
      distributions.refunds.maximumAmountFractionPerRefund <= 1
  );
  assert.equal(distributions.reviews.eligibleSellerOrderStatus, "DELIVERED");
  assert.equal(distributions.inventory.purchaseEligibleCategory, "reserved");
  assert.equal(distributions.inventory.reservationStatus, "ACTIVE");
  assert.deepEqual(distributions.inventory.lowStockAvailableRange, [1, 3]);
  assert.deepEqual(distributions.inventory.reservedAvailableRange, [0, 3]);
  assert.ok(distributions.inventory.availableMinimum > 3);
  assert.ok(distributions.inventory.reservationQuantityRange[0] > 0);
  assert.ok(
    distributions.inventory.reservationQuantityRange[1] >=
      distributions.inventory.reservationQuantityRange[0]
  );

  for (const profile of Object.values(config.profiles)) {
    const reservedProducts = Math.round(
      profile.exact.products * distributions.inventory.finalCategories.reserved
    );

    assert.ok(reservedProducts <= profile.estimated.inventoryReservations);
    assert.ok(
      profile.estimated.inventoryReservations *
        distributions.inventory.reservationQuantityRange[1] < 2147483647
    );
  }
  assert.ok(distributions.chronology.minimumEventGapSeconds > 0);
  assert.ok(
    distributions.chronology.windowDays * 24 >
      distributions.chronology.deliveryFirstStageHours +
        6 * distributions.chronology.deliveryFollowingStageHours
  );

  for (const rule of [
    "distinctSellerPerOrder",
    "productSellerMatchesSellerOrder",
    "snapshotTotalsInCents",
    "fullPaymentPerAttempt",
    "refundsOnlyAfterCapture",
    "reviewExactlyOneTarget",
    "uniqueReviewPerAuthorAndTarget",
  ]) {
    assert.equal(distributions.relationships[rule], true);
  }

  for (const rule of [
    "maximumActivePaymentsPerOrder",
    "maximumCapturedPaymentsPerOrder",
    "maximumDeliveryPerSellerOrder",
    "maximumActiveCartPerCustomer",
    "maximumDefaultAddressPerCustomer",
  ]) {
    assert.equal(distributions.relationships[rule], 1);
  }
});

test("future loading starts with small and requires authorization for other profiles", () => {
  assert.equal(config.executionPolicy.firstLoadProfile, "small");
  assert.equal(config.executionPolicy.mediumRequiresExplicitApproval, true);
  assert.equal(config.executionPolicy.largeRequiresExplicitApproval, true);
  assert.equal(config.executionPolicy.automaticProfileAdvance, false);
  assert.equal(config.executionPolicy.databaseName, "marketplace_scale");
});
