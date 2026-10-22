const { createHash } = require("node:crypto");
const config = require("../../config/scale-profiles.json");
const { assertProfileApproval } = require("./environment");

const GENERATOR_VERSION = "1.0.0";
const MINUTE = 60000;
const DAY = 86400000;

function allocate(total, weights) {
  const entries = Object.entries(weights).map(([key, weight], index) => {
    const exact = total * weight;

    return { key, index, count: Math.floor(exact), fraction: exact % 1 };
  });
  const remainder =
    total - entries.reduce((sum, entry) => sum + entry.count, 0);
  const sorted = [...entries].sort((a, b) => {
    const difference = b.fraction - a.fraction;

    return Math.abs(difference) < 1e-10 ? a.index - b.index : difference;
  });

  if (remainder < 0 || remainder > entries.length) {
    throw new Error("Invalid allocation weights");
  }

  for (let index = 0; index < remainder; index += 1) {
    sorted[index].count += 1;
  }

  return Object.fromEntries(entries.map((entry) => [entry.key, entry.count]));
}

function expand(quotas) {
  return Object.entries(quotas).flatMap(([value, count]) =>
    Array(count).fill(value),
  );
}

function randomSource(seed) {
  let state = seed >>> 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }

  return result;
}

function balanced(total, length, random) {
  if (length === 0) {
    if (total !== 0) throw new Error("Nonzero quota without participants");
    return [];
  }

  return shuffle(
    Array.from({ length }, (_, index) => {
      return Math.floor(total / length) + (index < total % length ? 1 : 0);
    }),
    random,
  );
}

function id(plan, kind, index) {
  const text = [
    config.randomSeed,
    config.version,
    GENERATOR_VERSION,
    plan.name,
    kind,
    index,
  ].join(":");
  const hex = createHash("sha256")
    .update(text)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = "8";
  const value = hex.join("");

  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function buildPlan(name, approval, smallMeasured = false) {
  assertProfileApproval(name, approval, smallMeasured);
  const profile = config.profiles[name];
  const rules = config.distributions;
  const random = randomSource(config.randomSeed);
  const base = Date.parse(config.baseDateUtc);
  const plan = {
    name,
    profile,
    base,
    sellers: [],
    products: [],
    orders: [],
    sellerOrders: [],
    items: [],
    reviews: [],
  };
  const leaders = Math.ceil(
    profile.exact.sellers * rules.sellerConcentration.leadingSellerFraction,
  );
  const sellerGroups = shuffle(
    Array.from({ length: profile.exact.sellers }, (_, i) => i),
    random,
  );
  const hotSellers = sellerGroups.slice(0, leaders);
  const otherSellers = sellerGroups.slice(leaders);
  const hotProducts = Math.round(
    profile.exact.products * rules.sellerConcentration.productShare,
  );
  const catalogs = new Map();

  for (const [group, total] of [
    [hotSellers, hotProducts],
    [otherSellers, profile.exact.products - hotProducts],
  ]) {
    const sizes = balanced(total, group.length, random);

    group.forEach((seller, index) => {
      const catalog = [];
      const popularCount = Math.ceil(
        sizes[index] * rules.productPopularity.popularFraction,
      );

      for (let local = 0; local < sizes[index]; local += 1) {
        const product = {
          index: plan.products.length,
          seller,
          price: 100 + Math.floor(random() * 9901),
          popular: local < popularCount,
          reserved: 0,
          lastReservationAt: base,
          category: "available",
        };
        catalog.push(product);
        plan.products.push(product);
      }

      const minimum = Math.max(
        popularCount + 1,
        profile.derivation.itemsPerSellerOrderMaximum,
      );
      catalog.slice(0, minimum).forEach((product) => {
        product.category = "reserved";
      });
      catalogs.set(seller, catalog);
    });
  }

  const stockQuotas = allocate(
    profile.exact.products,
    rules.inventory.finalCategories,
  );
  let reservedNeeded =
    stockQuotas.reserved -
    plan.products.filter((p) => p.category === "reserved").length;
  const unreserved = shuffle(
    plan.products.filter((p) => p.category !== "reserved"),
    random,
  );

  if (reservedNeeded < 0)
    throw new Error("Reserved product quota cannot cover seller capacities");
  unreserved.slice(0, reservedNeeded).forEach((product) => {
    product.category = "reserved";
  });
  const otherStock = expand({
    outOfStock: stockQuotas.outOfStock,
    lowStock: stockQuotas.lowStock,
    available: stockQuotas.available,
  });
  unreserved.slice(reservedNeeded).forEach((product, i) => {
    product.category = otherStock[i];
  });

  const buyers = allocate(
    profile.exact.customers,
    rules.customerPurchases.finalCategories,
  );
  const singles = Array.from(
    { length: buyers.single },
    (_, i) => buyers.never + i,
  );
  const repeatStart = buyers.never + buyers.single;
  const buyerAssignments = shuffle(
    [
      ...singles,
      ...Array.from(
        { length: profile.exact.orders - buyers.single },
        (_, i) => {
          return repeatStart + (i % buyers.repeat);
        },
      ),
    ],
    random,
  );
  const paidCount = profile.indicators.capturedPaymentAttempts;
  const paidFlags = shuffle(
    Array.from({ length: profile.exact.orders }, (_, i) => i < paidCount),
    random,
  );
  const paidOrders = [];
  const unpaidOrders = [];

  for (let index = 0; index < profile.exact.orders; index += 1) {
    const order = {
      index,
      customer: buyerAssignments[index],
      paid: paidFlags[index],
      at: base + DAY + Math.floor((index * 330 * DAY) / profile.exact.orders),
      sellerOrders: [],
      total: 0,
      attempts: [],
    };
    plan.orders.push(order);
    (order.paid ? paidOrders : unpaidOrders).push(order);
  }

  const paidSellerCount = profile.indicators.paidSellerOrders;

  for (const [orders, count] of [
    [paidOrders, paidSellerCount],
    [unpaidOrders, profile.estimated.sellerOrders - paidSellerCount],
  ]) {
    const slots = balanced(count, orders.length, random);
    orders.forEach((order, i) => {
      order.slots = slots[i];
    });
  }

  let hotNeeded = Math.round(
    profile.estimated.sellerOrders * rules.sellerConcentration.sellerOrderShare,
  );

  for (const order of plan.orders) {
    order.hot = Math.floor(
      order.slots * rules.sellerConcentration.sellerOrderShare,
    );
    hotNeeded -= order.hot;
  }

  for (const order of shuffle(plan.orders, random)) {
    const extra = Math.min(
      hotNeeded,
      order.slots - order.hot,
      leaders - order.hot,
    );
    order.hot += extra;
    hotNeeded -= extra;
  }

  if (hotNeeded !== 0)
    throw new Error("Cannot satisfy seller concentration without duplicates");
  const scenarioQuotas = allocate(
    paidSellerCount,
    Object.fromEntries(
      Object.entries(rules.sellerOrders.scenarios).map(([key, value]) => [
        key,
        value.share,
      ]),
    ),
  );
  const scenarioNames = shuffle(expand(scenarioQuotas), random);
  let paidCursor = 0;
  let hotCursor = 0;
  let otherCursor = 0;

  for (const order of plan.orders) {
    const sellers = [];

    for (let slot = 0; slot < order.hot; slot += 1) {
      sellers.push(hotSellers[hotCursor++ % hotSellers.length]);
    }

    for (let slot = order.hot; slot < order.slots; slot += 1) {
      sellers.push(otherSellers[otherCursor++ % otherSellers.length]);
    }

    for (const seller of sellers) {
      const entry = {
        index: plan.sellerOrders.length,
        order: order.index,
        seller,
        scenario: order.paid ? scenarioNames[paidCursor++] : "unpaid",
        products: [],
        items: [],
        total: 0,
      };
      order.sellerOrders.push(entry.index);
      plan.sellerOrders.push(entry);
    }
  }

  const itemCounts = balanced(
    profile.estimated.orderItems,
    plan.sellerOrders.length,
    random,
  );
  const sellerLines = {};
  plan.sellerOrders.forEach((so, i) => {
    so.itemCount = itemCounts[i];
    sellerLines[so.seller] = (sellerLines[so.seller] || 0) + so.itemCount;
  });
  const popularLineTotal = Math.round(
    profile.estimated.orderItems * rules.productPopularity.orderItemShare,
  );
  const popularQuotas = allocate(
    popularLineTotal,
    Object.fromEntries(
      Object.entries(sellerLines).map(([seller, count]) => [
        seller,
        count / profile.estimated.orderItems,
      ]),
    ),
  );

  for (const [seller, catalog] of catalogs) {
    const orders = plan.sellerOrders.filter((so) => so.seller === seller);
    const popular = catalog.filter((p) => p.popular);
    const others = catalog.filter(
      (p) => !p.popular && p.category === "reserved",
    );
    let remaining = popularQuotas[seller];

    for (const so of orders) {
      so.popularCount = Math.max(
        so.itemCount - others.length,
        Math.floor(so.itemCount * rules.productPopularity.orderItemShare),
      );
      remaining -= so.popularCount;
    }

    for (const so of orders) {
      const extra = Math.min(
        remaining,
        so.itemCount - so.popularCount,
        popular.length - so.popularCount,
      );
      so.popularCount += extra;
      remaining -= extra;
    }

    if (remaining !== 0) throw new Error("Cannot fulfill popularity quota");
    let popularCursor = 0;
    let regularCursor = 0;

    for (const so of orders) {
      for (let item = 0; item < so.itemCount; item += 1) {
        const product =
          item < so.popularCount
            ? popular[popularCursor++ % popular.length]
            : others[regularCursor++ % others.length];
        so.products.push(product.index);
      }
    }
  }

  for (const so of plan.sellerOrders) {
    for (const productIndex of so.products) {
      const product = plan.products[productIndex];
      const quantity = 1 + Math.floor(random() * 3);
      const item = {
        index: plan.items.length,
        sellerOrder: so.index,
        product: productIndex,
        quantity,
        price: product.price,
        total: quantity * product.price,
        at: plan.orders[so.order].at,
        reservedAfter: product.reserved + quantity,
      };
      product.reserved += quantity;
      product.lastReservationAt = item.at;
      so.items.push(item.index);
      so.total += item.total;
      plan.orders[so.order].total += item.total;
      plan.items.push(item);
    }
  }

  for (const product of plan.products) {
    if (product.category === "reserved" && product.reserved === 0) {
      throw new Error("Reserved category has no purchasing lines");
    }

    product.available =
      product.category === "outOfStock"
        ? 0
        : product.category === "reserved"
          ? Math.floor(random() * 4)
          : product.category === "lowStock"
            ? 1 + Math.floor(random() * 3)
            : 4 + Math.floor(random() * 20);
    product.onHand = product.reserved + product.available;
  }

  const extraAttempts =
    profile.estimated.paymentAttempts - profile.exact.orders;
  const retryStates = shuffle(
    expand(
      allocate(
        extraAttempts,
        rules.events.paymentRetries.priorAttemptFinalStates,
      ),
    ),
    random,
  );
  const unpaidStates = shuffle(
    expand(
      allocate(
        unpaidOrders.length,
        rules.orders.scenarios.unpaid.paymentFinalStates,
      ),
    ),
    random,
  );
  const retries = new Map(
    shuffle(paidOrders, random)
      .slice(0, extraAttempts)
      .map((order, i) => [order.index, retryStates[i]]),
  );
  let unpaidCursor = 0;

  for (const order of plan.orders) {
    const states = retries.has(order.index) ? [retries.get(order.index)] : [];
    states.push(order.paid ? "CAPTURED" : unpaidStates[unpaidCursor++]);
    let start = order.at + MINUTE;

    for (const status of states) {
      const paymentPath = rules.orders.paymentPaths[status];
      const attempt = {
        status,
        start,
        end: start + (paymentPath.length - 1) * MINUTE,
      };
      order.attempts.push(attempt);
      start = attempt.end + MINUTE;
    }

    order.captureAt = order.paid ? order.attempts.at(-1).end : null;
  }

  for (const target of ["product", "seller"]) {
    const candidates = new Map();

    for (const so of plan.sellerOrders.filter(
      (entry) => entry.scenario === "delivered",
    )) {
      const customer = plan.orders[so.order].customer;
      const targets =
        target === "seller"
          ? [so.seller]
          : so.items.map((index) => plan.items[index].product);

      for (const value of targets) {
        candidates.set(`${customer}:${value}`, {
          target,
          value,
          customer,
          sellerOrder: so.index,
        });
      }
    }

    const requested =
      profile.estimated[
        target === "product" ? "productReviews" : "sellerReviews"
      ];

    if (candidates.size < requested)
      throw new Error("Insufficient distinct delivered review pairs");
    plan.reviews.push(
      ...shuffle([...candidates.values()], random).slice(0, requested),
    );
  }

  plan.ratings = shuffle(
    expand(allocate(plan.reviews.length, rules.reviews.ratings)),
    random,
  );
  plan.refundStates = shuffle(
    expand(allocate(profile.estimated.refunds, rules.refunds.finalStates)),
    random,
  );
  plan.cartStates = expand(
    allocate(profile.exact.carts, rules.carts.finalStates),
  );
  plan.cartItemCounts = balanced(
    profile.estimated.cartItems,
    profile.exact.carts,
    random,
  );
  plan.paidOrders = paidOrders.map((order) => order.index);
  return plan;
}

function logistics(plan, sellerOrder) {
  const order = plan.orders[sellerOrder.order];
  const scenario =
    sellerOrder.scenario === "unpaid"
      ? { sellerOrderPath: ["PENDING"], deliveryPath: [] }
      : config.distributions.sellerOrders.scenarios[sellerOrder.scenario];
  const start = (order.captureAt || order.at) + 3 * MINUTE;
  const deliveryTimes = scenario.deliveryPath.map((_, index) => {
    return start + (index === 0 ? 0 : 4 * 3600000 + (index - 1) * DAY);
  });
  const sellerTimes = scenario.sellerOrderPath.map((status) => {
    if (status === "PENDING") return order.at;
    if (status === "CONFIRMED") return order.captureAt + MINUTE;
    if (status === "PROCESSING") return order.captureAt + 2 * MINUTE;
    const deliveryStatus = status === "SHIPPED" ? "SHIPPED" : status;
    return deliveryTimes[scenario.deliveryPath.indexOf(deliveryStatus)];
  });

  return { ...scenario, deliveryTimes, sellerTimes };
}

module.exports = {
  config,
  GENERATOR_VERSION,
  MINUTE,
  DAY,
  allocate,
  id,
  buildPlan,
  logistics,
};
