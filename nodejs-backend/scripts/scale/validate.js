const { Prisma } = require("@prisma/client");
const { countRows } = require("./database");
const { TABLES } = require("./records");

// Read-only checks; never repair data or rewrite states after a partial load.
const CHECKS = {
  ownershipAndMoney: `
    SELECT count(*) FROM order_item oi
    JOIN product p ON p.id=oi."productId" JOIN seller_order so ON so.id=oi."sellerOrderId"
    WHERE p."sellerId"<>so."sellerId" OR oi."lineTotalInCents"<>oi.quantity*oi."unitPriceInCents"
      OR oi.currency<>so.currency OR oi."productNameSnapshot"<>p.name
      OR oi."productReferenceSnapshot" IS DISTINCT FROM p.reference`,
  aggregateTotals: `
    SELECT count(*) FROM (
      SELECT so.id FROM seller_order so LEFT JOIN order_item oi ON oi."sellerOrderId"=so.id
      GROUP BY so.id HAVING so."totalInCents"<>coalesce(sum(oi."lineTotalInCents"),0)
      UNION ALL
      SELECT o.id FROM "order" o LEFT JOIN seller_order so ON so."orderId"=o.id
      GROUP BY o.id HAVING o."totalInCents"<>coalesce(sum(so."totalInCents"),0)
    ) invalid`,
  integralPayments: `
    SELECT count(*) FROM payment_attempt p JOIN "order" o ON o.id=p."orderId"
    WHERE p."amountInCents"<>o."totalInCents" OR p.currency<>o.currency
      OR (p.status='CAPTURED' AND (o.status<>'CONFIRMED' OR p."capturedAt" IS NULL))
      OR (p.status='FAILED' AND (p."failedAt" IS NULL OR p."failureCode" IS NULL))`,
  paymentExclusivity: `
    SELECT count(*) FROM (
      SELECT o.id FROM "order" o LEFT JOIN payment_attempt p ON p."orderId"=o.id
      GROUP BY o.id HAVING count(*) FILTER (WHERE p.status='CAPTURED')>1
        OR count(*) FILTER (WHERE p.status IN ('CREATED','PROCESSING','AUTHORIZED'))>1
        OR (o.status='CONFIRMED' AND count(*) FILTER (WHERE p.status='CAPTURED')<>1)
        OR (o.status='PENDING_PAYMENT' AND count(*) FILTER (WHERE p.status='CAPTURED')<>0)
    ) invalid`,
  refunds: `
    SELECT count(*) FROM (
      SELECT r.id FROM refund r JOIN payment_attempt p ON p.id=r."paymentAttemptId"
      WHERE p.status<>'CAPTURED' OR p.currency<>r.currency OR r."createdAt"<p."capturedAt"
        OR (r.status='COMPLETED' AND r."completedAt" IS NULL)
        OR (r.status='FAILED' AND r."failedAt" IS NULL)
        OR (r.status='DECLINED' AND (r."completedAt" IS NOT NULL OR r."failedAt" IS NOT NULL))
      UNION ALL
      SELECT p.id FROM payment_attempt p JOIN refund r ON r."paymentAttemptId"=p.id
      GROUP BY p.id HAVING coalesce(sum(r."amountInCents") FILTER
        (WHERE r.status IN ('REQUESTED','PROCESSING','COMPLETED')),0)>p."amountInCents"
    ) invalid`,
  reviewEligibility: `
    SELECT count(*) FROM review r JOIN "user" u ON u.id=r."userId"
    WHERE u.role<>'CUSTOMER' OR ((r."productId" IS NULL)=(r."sellerId" IS NULL))
      OR NOT EXISTS (
        SELECT 1 FROM customer c JOIN "order" o ON o."customerId"=c.id
        JOIN seller_order so ON so."orderId"=o.id JOIN order_item oi ON oi."sellerOrderId"=so.id
        WHERE c."userId"=r."userId" AND so.status='DELIVERED'
          AND so."completedAt"<=r."createdAt"
          AND (oi."productId"=r."productId" OR so."sellerId"=r."sellerId")
      )`,
  reservations: `
    SELECT count(*) FROM inventory_reservation r JOIN order_item oi ON oi.id=r."orderItemId"
    JOIN inventory i ON i.id=r."inventoryId"
    WHERE r.quantity<>oi.quantity OR i."productId"<>oi."productId" OR r.status<>'ACTIVE'`,
  inventoryBalance: `
    SELECT count(*) FROM inventory i WHERE i."reservedQuantity"<0
      OR i."onHandQuantity"<i."reservedQuantity"
      OR i."reservedQuantity"<>(SELECT coalesce(sum(r.quantity),0)
        FROM inventory_reservation r WHERE r."inventoryId"=i.id AND r.status='ACTIVE')
      OR i."onHandQuantity"<>(SELECT coalesce(sum(m."onHandDelta"),0)
        FROM inventory_movement m WHERE m."inventoryId"=i.id)
      OR i."reservedQuantity"<>(SELECT coalesce(sum(m."reservedDelta"),0)
        FROM inventory_movement m WHERE m."inventoryId"=i.id)`,
  movementSequence: `
    SELECT count(*) FROM (
      SELECT *, sum("onHandDelta") OVER w AS physical,
        sum("reservedDelta") OVER w AS reserved
      FROM inventory_movement WINDOW w AS
        (PARTITION BY "inventoryId" ORDER BY "createdAt",id ROWS UNBOUNDED PRECEDING)
    ) m WHERE m."onHandAfter"<>physical OR m."reservedAfter"<>reserved
      OR reserved<0 OR physical<reserved`,
  reservationMovements: `
    SELECT count(*) FROM inventory_reservation r WHERE
      (SELECT count(*) FROM inventory_movement m WHERE m."orderItemId"=r."orderItemId"
        AND m."movementType"='RESERVATION' AND m."reservedDelta"=r.quantity
        AND m."onHandDelta"=0)<>1`,
  addressesAndProfiles: `
    SELECT count(*) FROM (
      SELECT c.id FROM customer c JOIN "user" u ON u.id=c."userId" WHERE u.role<>'CUSTOMER'
      UNION ALL SELECT s.id FROM seller s JOIN "user" u ON u.id=s."userId" WHERE u.role<>'SELLER'
      UNION ALL SELECT o.id FROM "order" o LEFT JOIN order_address a ON a."orderId"=o.id
        LEFT JOIN customer_address ca ON ca.id=a."sourceAddressId"
        WHERE a.id IS NULL OR ca."customerId" IS DISTINCT FROM o."customerId"
      UNION ALL SELECT c.id FROM customer c WHERE
        (SELECT count(*) FROM customer_address a WHERE a."customerId"=c.id
          AND a."isDefault" AND a."isActive")<>1
    ) invalid`,
  idempotency: `
    SELECT count(*) FROM idempotency_key k JOIN "order" o ON o.id=k."orderId"
    JOIN customer c ON c.id=o."customerId"
    WHERE k."userId"<>c."userId" OR k.status<>'COMPLETED' OR k.operation<>'CHECKOUT_V1'
      OR k.result->>'id'<>o.id OR k.result->>'status'<>'PENDING_PAYMENT'
      OR (k.result->>'totalInCents')::integer<>o."totalInCents"`,
  financialTimestamps: `
    SELECT count(*) FROM payment_attempt p WHERE p."createdAt">p."updatedAt"
      OR p."authorizedAt"<p."createdAt" OR p."capturedAt"<p."authorizedAt"
      OR p."failedAt"<p."createdAt" OR p."cancelledAt"<p."createdAt"`,
  deliveryConsistency: `
    SELECT count(*) FROM delivery d JOIN seller_order so ON so.id=d."sellerOrderId"
    JOIN "order" o ON o.id=so."orderId" WHERE o.status<>'CONFIRMED'
      OR so.status IN ('PENDING','CANCELLED')
      OR (so.status='DELIVERED' AND d.status<>'DELIVERED')
      OR (so.status='RETURNED' AND d.status<>'RETURNED')
      OR (d.status IN ('DELIVERED','RETURNED') AND d."deliveredAt" IS NULL)`,
};

async function validate(db, expected, baseDate) {
  const counts = await countRows(db);

  if (expected) {
    for (const [name, amount] of Object.entries(expected)) {
      if (counts[name] !== amount)
        throw new Error(`Count invariant failed for ${name}`);
    }
  }

  const checked = [];

  for (const [name, sql] of Object.entries(CHECKS)) {
    const [result] = await db.$queryRaw(Prisma.raw(sql));
    if (Number(result.count) !== 0)
      throw new Error(`Invariant failed: ${name}`);
    checked.push(name);
  }

  for (const [table, history, owner, at] of [
    ["order", "order_status_history", "orderId", "createdAt"],
    [
      "seller_order",
      "seller_order_status_history",
      "sellerOrderId",
      "createdAt",
    ],
    ["delivery", "delivery_status_history", "deliveryId", "changedAt"],
  ]) {
    const [result] = await db.$queryRaw(
      Prisma.raw(`
      SELECT count(*) FROM (
        SELECT h.*, lag("toStatus") OVER w AS previous,
          row_number() OVER w AS sequence
        FROM "${history}" h WINDOW w AS (PARTITION BY "${owner}" ORDER BY "${at}",id)
      ) h WHERE (sequence=1 AND "fromStatus" IS NOT NULL)
        OR (sequence>1 AND "fromStatus" IS DISTINCT FROM previous)
    `),
    );
    const [latest] = await db.$queryRaw(
      Prisma.raw(`
      SELECT count(*) FROM "${table}" t LEFT JOIN LATERAL (
        SELECT "toStatus" FROM "${history}" WHERE "${owner}"=t.id
        ORDER BY "${at}" DESC,id DESC LIMIT 1
      ) h ON true WHERE t.status IS DISTINCT FROM h."toStatus"
    `),
    );

    if (Number(result.count) || Number(latest.count)) {
      throw new Error(`History sequence invariant failed: ${table}`);
    }
    checked.push(`${table}:history`);
  }

  if (baseDate) {
    for (const [, table] of TABLES) {
      const field =
        table === "delivery_status_history" ? "changedAt" : "createdAt";
      const [result] = await db.$queryRaw(Prisma.sql`
        SELECT count(*) FROM ${Prisma.raw(`"${table}"`)}
        WHERE ${Prisma.raw(`"${field}"`)} < ${new Date(baseDate)}
          OR ${Prisma.raw(`"${field}"`)} > ${new Date(Date.parse(baseDate) + 365 * 86400000)}
      `);

      if (Number(result.count))
        throw new Error(`Date window invariant failed: ${table}`);
    }
    checked.push("fixedDateWindow");
  }

  return {
    counts,
    checked,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

module.exports = { validate };
