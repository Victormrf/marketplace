const bcrypt = require("bcrypt");
const { createHash } = require("node:crypto");
const { config, id, logistics, MINUTE, DAY } = require("./planner");

// Explicit insertion order and purge allowlist. No object outside this list is truncated.
const TABLES = [
  ["user", "user"],
  ["customerProfile", "customer"],
  ["seller", "seller"],
  ["customerAddress", "customer_address"],
  ["product", "product"],
  ["inventory", "inventory"],
  ["cart", "cart"],
  ["cartItem", "cart_item"],
  ["order", "order"],
  ["sellerOrder", "seller_order"],
  ["orderItem", "order_item"],
  ["orderAddress", "order_address"],
  ["paymentAttempt", "payment_attempt"],
  ["refund", "refund"],
  ["delivery", "delivery"],
  ["orderStatusHistory", "order_status_history"],
  ["sellerOrderStatusHistory", "seller_order_status_history"],
  ["deliveryStatusHistory", "delivery_status_history"],
  ["inventoryReservation", "inventory_reservation"],
  ["inventoryMovement", "inventory_movement"],
  ["review", "review"],
  ["idempotencyKey", "idempotency_key"],
];
const password = bcrypt.hashSync(
  "scale-local-only",
  "$2b$10$C6UzMDM.H6dfI/f/IKcEe.",
);
const iso = (at) => new Date(at).toISOString();
const stamps = (at, updated = at) => ({
  createdAt: iso(at),
  updatedAt: iso(updated),
});
const money = (total) => ({
  subtotalInCents: total,
  totalInCents: total,
  currency: "BRL",
  shippingInCents: 0,
  taxInCents: 0,
  discountInCents: 0,
});

function address(plan, customer) {
  return {
    recipientName: `Scale customer ${customer}`,
    postalCode: "01310-100",
    street: "Synthetic street",
    number: String(customer + 1),
    complement: null,
    neighborhood: "Scale district",
    city: "Sao Paulo",
    state: "SP",
    countryCode: "BR",
    phone: null,
  };
}

function attemptId(plan, order, index) {
  return id(plan, "payment", `${order.index}:${index}`);
}

function providerReference(value, refund = false) {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 24);
  return `${refund ? "dev_refund_" : "dev_"}${hash}`;
}

function checkoutDto(plan, order) {
  return {
    id: id(plan, "order", order.index),
    status: "PENDING_PAYMENT",
    ...money(order.total),
    ...stamps(order.at),
    address: {
      id: id(plan, "orderAddress", order.index),
      sourceAddressId: id(plan, "address", order.customer),
      ...address(plan, order.customer),
      createdAt: iso(order.at),
    },
    sellerOrders: order.sellerOrders.map((index) => {
      const so = plan.sellerOrders[index];

      return {
        id: id(plan, "sellerOrder", so.index),
        sellerId: id(plan, "seller", so.seller),
        status: "PENDING",
        ...money(so.total),
        items: so.items.map((itemIndex) => {
          const item = plan.items[itemIndex];

          return {
            id: id(plan, "item", item.index),
            productId: id(plan, "product", item.product),
            quantity: item.quantity,
            unitPriceInCents: item.price,
            lineTotalInCents: item.total,
            currency: "BRL",
            productNameSnapshot: `Scale product ${item.product}`,
            productReferenceSnapshot: `SCALE-${item.product}`,
            sellerNameSnapshot: `Scale store ${so.seller}`,
            reservation: {
              id: id(plan, "reservation", item.index),
              status: "ACTIVE",
              quantity: item.quantity,
              expiresAt: iso(order.at + 15 * MINUTE),
            },
          };
        }),
      };
    }),
  };
}

function* rows(model, plan) {
  const { profile, base } = plan;
  const exact = profile.exact;

  if (model === "user") {
    for (let i = 0; i < profile.estimated.users; i += 1) {
      const role = i < exact.customers ? "CUSTOMER" : "SELLER";
      const email = `scale.${plan.name}.${i}@local.invalid`;
      yield {
        id: id(plan, "user", i),
        name: `Scale user ${i}`,
        email,
        normalizedEmail: email,
        password,
        role,
        isActive: true,
        ...stamps(base),
      };
    }
  } else if (model === "customerProfile" || model === "seller") {
    const customer = model === "customerProfile";
    const count = customer ? exact.customers : exact.sellers;

    for (let i = 0; i < count; i += 1) {
      yield {
        id: id(plan, customer ? "customer" : "seller", i),
        userId: id(plan, "user", customer ? i : exact.customers + i),
        ...(customer
          ? { phone: null }
          : {
              storeName: `Scale store ${i}`,
              description: "Synthetic scale seller",
              isActive: true,
            }),
        ...stamps(base),
      };
    }
  } else if (model === "customerAddress") {
    for (let i = 0; i < profile.estimated.customerAddresses; i += 1) {
      yield {
        id: id(plan, "address", i),
        customerId: id(plan, "customer", i % exact.customers),
        ...address(plan, i % exact.customers),
        isDefault: i < exact.customers,
        isActive: true,
        ...stamps(base),
      };
    }
  } else if (model === "product" || model === "inventory") {
    for (const p of plan.products) {
      yield model === "product"
        ? {
            id: id(plan, "product", p.index),
            sellerId: id(plan, "seller", p.seller),
            name: `Scale product ${p.index}`,
            reference: `SCALE-${p.index}`,
            description: "Synthetic scale catalog",
            priceInCents: p.price,
            currency: "BRL",
            category: p.index % 2 ? "ELECTRONICS" : "OFFICE",
            image: `https://example.invalid/scale/${p.index}.jpg`,
            isActive: true,
            ...stamps(base),
          }
        : {
            id: id(plan, "inventory", p.index),
            productId: id(plan, "product", p.index),
            onHandQuantity: p.onHand,
            reservedQuantity: p.reserved,
            ...stamps(base, Math.max(base + 10 * MINUTE, p.lastReservationAt)),
          };
    }
  } else if (model === "cart" || model === "cartItem") {
    let itemIndex = 0;

    for (let i = 0; i < exact.carts; i += 1) {
      if (model === "cart") {
        yield {
          id: id(plan, "cart", i),
          customerId: id(plan, "customer", i),
          status: plan.cartStates[i],
          abandonedAt:
            plan.cartStates[i] === "ABANDONED" ? iso(base + 10 * DAY) : null,
          ...stamps(base, base + 10 * DAY),
        };
      } else {
        for (let j = 0; j < plan.cartItemCounts[i]; j += 1) {
          yield {
            id: id(plan, "cartItem", itemIndex++),
            cartId: id(plan, "cart", i),
            productId: id(plan, "product", (i * 3 + j) % exact.products),
            quantity: 1 + (j % 3),
            ...stamps(base),
          };
        }
      }
    }
  } else if (
    [
      "order",
      "orderAddress",
      "orderStatusHistory",
      "paymentAttempt",
      "idempotencyKey",
    ].includes(model)
  ) {
    for (const order of plan.orders) {
      const orderId = id(plan, "order", order.index);

      if (model === "order") {
        yield {
          id: orderId,
          customerId: id(plan, "customer", order.customer),
          status: order.paid ? "CONFIRMED" : "PENDING_PAYMENT",
          ...money(order.total),
          confirmedAt: order.paid ? iso(order.captureAt) : null,
          ...stamps(order.at, order.captureAt || order.at),
        };
      } else if (model === "orderAddress") {
        yield {
          id: id(plan, "orderAddress", order.index),
          orderId,
          sourceAddressId: id(plan, "address", order.customer),
          ...address(plan, order.customer),
          createdAt: iso(order.at),
        };
      } else if (model === "orderStatusHistory") {
        yield {
          id: id(plan, "orderHistory", `${order.index}:0`),
          orderId,
          fromStatus: null,
          toStatus: "PENDING_PAYMENT",
          createdAt: iso(order.at),
        };

        if (order.paid) {
          yield {
            id: id(plan, "orderHistory", `${order.index}:1`),
            orderId,
            fromStatus: "PENDING_PAYMENT",
            toStatus: "CONFIRMED",
            reason: "Synthetic full capture",
            createdAt: iso(order.captureAt),
          };
        }
      } else if (model === "paymentAttempt") {
        for (let i = 0; i < order.attempts.length; i += 1) {
          const a = order.attempts[i];
          const identity = attemptId(plan, order, i);
          const authorized = ["AUTHORIZED", "CAPTURED"].includes(a.status);
          yield {
            id: identity,
            orderId,
            provider: "DEV_SIMULATOR",
            providerReference: providerReference(identity),
            method: "PIX",
            status: a.status,
            amountInCents: order.total,
            currency: "BRL",
            authorizedAt: authorized ? iso(a.start + 2 * MINUTE) : null,
            capturedAt: a.status === "CAPTURED" ? iso(a.end) : null,
            failedAt: a.status === "FAILED" ? iso(a.end) : null,
            cancelledAt: a.status === "CANCELLED" ? iso(a.end) : null,
            failureCode: a.status === "FAILED" ? "SYNTHETIC_DECLINED" : null,
            failureMessage:
              a.status === "FAILED" ? "Synthetic payment failure" : null,
            ...stamps(a.start, a.end),
          };
        }
      } else {
        const addressId = id(plan, "address", order.customer);
        yield {
          id: id(plan, "idempotency", order.index),
          userId: id(plan, "user", order.customer),
          orderId,
          operation: "CHECKOUT_V1",
          key: `scale:${plan.name}:${order.index}`,
          requestFingerprint: createHash("sha256")
            .update(JSON.stringify({ addressId }))
            .digest("hex"),
          status: "COMPLETED",
          result: checkoutDto(plan, order),
          completedAt: iso(order.at),
          expiresAt: iso(order.at + DAY),
          ...stamps(order.at),
        };
      }
    }
  } else if (
    [
      "sellerOrder",
      "delivery",
      "sellerOrderStatusHistory",
      "deliveryStatusHistory",
    ].includes(model)
  ) {
    for (const so of plan.sellerOrders) {
      const order = plan.orders[so.order];
      const timing = logistics(plan, so);
      const sellerOrderId = id(plan, "sellerOrder", so.index);
      const deliveryId = id(plan, "delivery", so.index);

      if (model === "sellerOrder") {
        const deliveredIndex = timing.deliveryPath.indexOf("DELIVERED");
        yield {
          id: sellerOrderId,
          orderId: id(plan, "order", so.order),
          sellerId: id(plan, "seller", so.seller),
          status: timing.sellerOrderPath.at(-1),
          ...money(so.total),
          confirmedAt: order.paid ? iso(timing.sellerTimes[1]) : null,
          completedAt:
            deliveredIndex >= 0
              ? iso(timing.deliveryTimes[deliveredIndex])
              : null,
          ...stamps(order.at, timing.sellerTimes.at(-1)),
        };
      } else if (model === "delivery" && timing.deliveryPath.length) {
        const deliveredIndex = timing.deliveryPath.indexOf("DELIVERED");
        yield {
          id: deliveryId,
          sellerOrderId,
          status: timing.deliveryPath.at(-1),
          carrier: "Synthetic carrier",
          trackingCode: `SCALE-${so.index}`,
          estimatedDelivery: iso(timing.deliveryTimes[0] + 5 * DAY),
          deliveredAt:
            deliveredIndex >= 0
              ? iso(timing.deliveryTimes[deliveredIndex])
              : null,
          ...stamps(timing.deliveryTimes[0], timing.deliveryTimes.at(-1)),
        };
      } else if (model.endsWith("StatusHistory")) {
        const delivery = model === "deliveryStatusHistory";
        const statuses = delivery
          ? timing.deliveryPath
          : timing.sellerOrderPath;
        const times = delivery ? timing.deliveryTimes : timing.sellerTimes;

        for (let step = 0; step < statuses.length; step += 1) {
          yield {
            id: id(
              plan,
              delivery ? "deliveryHistory" : "sellerHistory",
              `${so.index}:${step}`,
            ),
            [delivery ? "deliveryId" : "sellerOrderId"]: delivery
              ? deliveryId
              : sellerOrderId,
            fromStatus: step === 0 ? null : statuses[step - 1],
            toStatus: statuses[step],
            [delivery ? "changedAt" : "createdAt"]: iso(times[step]),
            reason: "Synthetic historical scenario",
          };
        }
      }
    }
  } else if (model === "orderItem" || model === "inventoryReservation") {
    for (const item of plan.items) {
      const so = plan.sellerOrders[item.sellerOrder];
      yield model === "orderItem"
        ? {
            id: id(plan, "item", item.index),
            sellerOrderId: id(plan, "sellerOrder", so.index),
            productId: id(plan, "product", item.product),
            quantity: item.quantity,
            unitPriceInCents: item.price,
            lineTotalInCents: item.total,
            currency: "BRL",
            productNameSnapshot: `Scale product ${item.product}`,
            productReferenceSnapshot: `SCALE-${item.product}`,
            sellerNameSnapshot: `Scale store ${so.seller}`,
            createdAt: iso(item.at),
          }
        : {
            id: id(plan, "reservation", item.index),
            orderItemId: id(plan, "item", item.index),
            inventoryId: id(plan, "inventory", item.product),
            quantity: item.quantity,
            status: "ACTIVE",
            expiresAt: iso(item.at + 15 * MINUTE),
            ...stamps(item.at),
          };
    }
  } else if (model === "inventoryMovement") {
    const extra = profile.derivation.additionalInventoryMovementsPerProduct;

    for (const p of plan.products) {
      for (let step = 0; step < extra; step += 1) {
        yield {
          id: id(plan, "extraMovement", `${p.index}:${step}`),
          inventoryId: id(plan, "inventory", p.index),
          movementType: step ? "MANUAL_CORRECTION" : "RESTOCK",
          onHandDelta: step ? -1 : p.onHand + extra - 1,
          reservedDelta: 0,
          onHandAfter: p.onHand + extra - 1 - step,
          reservedAfter: 0,
          reason: "Synthetic stock initialization",
          createdAt: iso(base + step * MINUTE),
        };
      }
    }

    for (const item of plan.items) {
      yield {
        id: id(plan, "reservationMovement", item.index),
        inventoryId: id(plan, "inventory", item.product),
        orderItemId: id(plan, "item", item.index),
        movementType: "RESERVATION",
        onHandDelta: 0,
        reservedDelta: item.quantity,
        onHandAfter: plan.products[item.product].onHand,
        reservedAfter: item.reservedAfter,
        createdAt: iso(item.at),
        reason: "Synthetic checkout reservation",
      };
    }
  } else if (model === "refund") {
    for (let index = 0; index < profile.estimated.refunds; index += 1) {
      const order = plan.orders[plan.paidOrders[Math.floor(index / 2)]];
      const status = plan.refundStates[index];
      const at = order.captureAt + MINUTE;
      const identity = id(plan, "refund", index);
      yield {
        id: identity,
        paymentAttemptId: attemptId(plan, order, order.attempts.length - 1),
        amountInCents: Math.floor(order.total * 0.2),
        currency: "BRL",
        status,
        reason: "Synthetic partial refund",
        providerReference:
          status === "COMPLETED" ? providerReference(identity, true) : null,
        completedAt: status === "COMPLETED" ? iso(at + 2 * MINUTE) : null,
        failedAt: status === "FAILED" ? iso(at + 2 * MINUTE) : null,
        ...stamps(at, at + (status === "REQUESTED" ? 0 : 2 * MINUTE)),
      };
    }
  } else if (model === "review") {
    for (let index = 0; index < plan.reviews.length; index += 1) {
      const review = plan.reviews[index];
      const timing = logistics(plan, plan.sellerOrders[review.sellerOrder]);
      yield {
        id: id(plan, "review", index),
        userId: id(plan, "user", review.customer),
        productId:
          review.target === "product"
            ? id(plan, "product", review.value)
            : null,
        sellerId:
          review.target === "seller" ? id(plan, "seller", review.value) : null,
        rating: Number(plan.ratings[index]),
        comment: "Synthetic delivered purchase review",
        ...stamps(timing.deliveryTimes.at(-1) + MINUTE),
      };
    }
  } else {
    throw new Error(`Unknown physical model ${model}`);
  }
}

function auditPlan(plan) {
  const counts = {};
  const hash = createHash("sha256");
  let total = 0;

  for (const [model, table] of TABLES) {
    counts[table] = 0;

    for (const row of rows(model, plan)) {
      hash.update(JSON.stringify([table, row]));
      counts[table] += 1;
      total += 1;
    }
  }

  if (
    total !== plan.profile.totalRows ||
    total > plan.profile.limits.maxRecords
  ) {
    throw new Error(`Plan physical count mismatch: ${total}`);
  }

  return { counts, total, datasetSha256: hash.digest("hex") };
}

module.exports = { TABLES, rows, auditPlan, checkoutDto };
