const { Prisma, SellerOrderStatus } = require("@prisma/client");
const plan = require("./plan.json");

function requests(manifest, scenario, variant, endpoint) {
  const first = manifest.products[0];
  if (scenario === "catalog") {
    const filtered = `search=Scale&sellerId=${encodeURIComponent(first.sellerId)}&category=${first.category}&inStock=true`;
    const variants = {
      all: "page=1&limit=20",
      search: `search=${encodeURIComponent(first.name || "Scale product 1")}&page=1&limit=5`,
      filtered1: `${filtered}&page=1&limit=5`,
      filtered2: `${filtered}&page=2&limit=5`,
      unavailable: "inStock=false&page=1&limit=20",
    };
    if (!variants[variant]) {
      throw new Error(
        "Choose catalog variant all/search/filtered1/filtered2/unavailable",
      );
    }
    return [
      { path: `/products?${variants[variant]}`, tag: `catalog/${variant}` },
    ];
  }
  if (scenario === "product" && variant === "popular") {
    return manifest.products.map((p) => ({
      path: `/products/${p.id}`,
      tag: "product/popular",
    }));
  }
  if (scenario === "dashboard" && ["high", "low"].includes(variant)) {
    const allowed = plan.scenarios.dashboard.paths.map((p) => p.slice(4));
    if (!allowed.includes(endpoint)) {
      throw new Error("Choose exactly one allowed dashboard endpoint");
    }
    const extra = endpoint.endsWith("/orders")
      ? "&page=1&limit=20&status=DELIVERED"
      : "";
    return [
      {
        path: `${endpoint}?from=${plan.dashboardRange.from}&to=${plan.dashboardRange.to}${extra}`,
        tag: `dashboard/${variant}/${endpoint.slice("/dashboard/seller/".length)}`,
        sellerIndex: variant === "high" ? 0 : 1,
      },
    ];
  }
  throw new Error("Unknown read scenario/variant; writes remain blocked");
}

async function products(tx, path) {
  const url = new URL(path, plan.apiUrl);
  const q = url.searchParams;
  const page = Number(q.get("page") || 1);
  const limit = Number(q.get("limit") || 20);
  const conditions = [Prisma.sql`p."isActive"=true AND s."isActive"=true`];
  if (url.pathname !== "/products") {
    conditions.push(Prisma.sql`p.id=${url.pathname.split("/").at(-1)}`);
  }
  if (q.has("search")) {
    conditions.push(Prisma.sql`p.name ILIKE ${`%${q.get("search")}%`}`);
  }
  if (q.has("sellerId")) {
    conditions.push(Prisma.sql`p."sellerId"=${q.get("sellerId")}`);
  }
  if (q.has("category")) {
    conditions.push(Prisma.sql`p.category::text=${q.get("category")}`);
  }
  if (q.has("inStock")) {
    conditions.push(
      q.get("inStock") === "true"
        ? Prisma.sql`i."onHandQuantity">i."reservedQuantity"`
        : Prisma.sql`(i.id IS NULL OR i."onHandQuantity"<=i."reservedQuantity")`,
    );
  }
  const where = Prisma.join(conditions, " AND ");
  const data = await tx.$queryRaw(Prisma.sql`
    SELECT p.id,p.name,p."sellerId",s."storeName" AS "sellerName",p.category,
      p."priceInCents",p.currency,
      json_build_object('onHandQuantity',coalesce(i."onHandQuantity",0),
        'reservedQuantity',coalesce(i."reservedQuantity",0),
        'availableQuantity',coalesce(i."onHandQuantity"-i."reservedQuantity",0)) AS inventory,
      coalesce(i."onHandQuantity">i."reservedQuantity",false) AS "isAvailable"
    FROM product p JOIN seller s ON s.id=p."sellerId"
    LEFT JOIN inventory i ON i."productId"=p.id WHERE ${where}
    ORDER BY p."createdAt" DESC,p.id ASC OFFSET ${(page - 1) * limit} LIMIT ${limit}
  `);
  if (url.pathname !== "/products") {
    if (data.length !== 1) {
      throw new Error("Product oracle did not find its target");
    }
    return data[0];
  }
  const [count] = await tx.$queryRaw(Prisma.sql`
    SELECT count(*)::integer AS total FROM product p JOIN seller s ON s.id=p."sellerId"
    LEFT JOIN inventory i ON i."productId"=p.id WHERE ${where}
  `);
  return {
    data,
    pagination: {
      page,
      limit,
      total: count.total,
      totalPages: Math.ceil(count.total / limit),
    },
  };
}

async function dashboard(tx, request, manifest) {
  const seller = manifest.sellers[request.sellerIndex].id;
  const url = new URL(request.path, plan.apiUrl);
  const endpoint = url.pathname.split("/seller/")[1];
  const from = new Date(plan.dashboardRange.from);
  const to = new Date(Date.parse(plan.dashboardRange.to) + 86400000);
  const delivered = Prisma.sql`so."sellerId"=${seller} AND so.status='DELIVERED' AND so."completedAt">=${from} AND so."completedAt"<${to}`;
  const created = Prisma.sql`so."sellerId"=${seller} AND so."createdAt">=${from} AND so."createdAt"<${to}`;
  if (endpoint === "summary") {
    const [s] = await tx.$queryRaw(Prisma.sql`
      SELECT coalesce(sum(so."totalInCents"),0)::integer AS "grossRevenueInCents",
        count(*)::integer AS "deliveredSellerOrders" FROM seller_order so WHERE ${delivered}
    `);
    const [items] = await tx.$queryRaw(Prisma.sql`
      SELECT coalesce(sum(oi.quantity),0)::integer AS "itemsSold" FROM order_item oi
      JOIN seller_order so ON so.id=oi."sellerOrderId" WHERE ${delivered}
    `);
    return {
      ...s,
      ...items,
      currency: "BRL",
      averageTicketInCents: s.deliveredSellerOrders
        ? Math.round(s.grossRevenueInCents / s.deliveredSellerOrders)
        : 0,
    };
  }
  if (endpoint === "orders") {
    const data = await tx.$queryRaw(Prisma.sql`
      SELECT so.id,so.status,so."totalInCents",so.currency,so."createdAt",so."completedAt"
      FROM seller_order so WHERE ${created} AND so.status='DELIVERED'
      ORDER BY so."createdAt" DESC,so.id DESC LIMIT 20
    `);
    const [row] = await tx.$queryRaw(
      Prisma.sql`SELECT count(*)::integer AS total FROM seller_order so WHERE ${created} AND so.status='DELIVERED'`,
    );
    return {
      data,
      pagination: {
        page: 1,
        limit: 20,
        total: row.total,
        totalPages: Math.ceil(row.total / 20),
      },
    };
  }
  if (endpoint === "orders/by-status") {
    const rows = await tx.$queryRaw(
      Prisma.sql`SELECT so.status,count(*)::integer AS count FROM seller_order so WHERE ${created} GROUP BY so.status`,
    );
    return Object.values(SellerOrderStatus).map((status) => ({
      status,
      count: rows.find((r) => r.status === status)?.count || 0,
    }));
  }
  if (endpoint === "ratings") {
    const grouped =
      await tx.$queryRaw`SELECT rating,count(*)::integer AS count FROM review WHERE "sellerId"=${seller} GROUP BY rating`;
    const total = grouped.reduce((sum, r) => sum + r.count, 0);
    const sum = grouped.reduce((value, r) => value + r.rating * r.count, 0);
    return {
      totalReviews: total,
      averageRating: total ? Number((sum / total).toFixed(2)) : null,
      distribution: Object.fromEntries(
        [1, 2, 3, 4, 5].map((n) => [
          n,
          grouped.find((r) => r.rating === n)?.count || 0,
        ]),
      ),
    };
  }
  if (endpoint === "sales/by-category") {
    return tx.$queryRaw(Prisma.sql`SELECT p.category,sum(oi."lineTotalInCents")::integer AS "grossRevenueInCents",sum(oi.quantity)::integer AS "itemsSold"
      FROM order_item oi JOIN seller_order so ON so.id=oi."sellerOrderId" JOIN product p ON p.id=oi."productId"
      WHERE ${delivered} GROUP BY p.category ORDER BY p.category ASC`);
  }
  if (endpoint === "products/top") {
    return tx.$queryRaw(Prisma.sql`SELECT oi."productId",
      (array_agg(oi."productNameSnapshot" ORDER BY oi."createdAt" DESC,oi.id DESC))[1] AS "productName",
      sum(oi.quantity)::integer AS "itemsSold",sum(oi."lineTotalInCents")::integer AS "grossRevenueInCents"
      FROM order_item oi JOIN seller_order so ON so.id=oi."sellerOrderId" WHERE ${delivered}
      GROUP BY oi."productId" ORDER BY "itemsSold" DESC,"grossRevenueInCents" DESC,oi."productId" ASC LIMIT 5`);
  }
  if (endpoint === "customers/new") {
    return tx.$queryRaw`WITH firsts AS (SELECT o."customerId",min(so."createdAt") AS first_at
      FROM seller_order so JOIN "order" o ON o.id=so."orderId" WHERE so."sellerId"=${seller} GROUP BY o."customerId")
      SELECT to_char(first_at,'YYYY-MM') AS period,count(*)::integer AS "newCustomers"
      FROM firsts WHERE first_at>=${from} AND first_at<${to} GROUP BY to_char(first_at,'YYYY-MM') ORDER BY period`;
  }
  if (endpoint === "sales/timeseries") {
    const rows =
      await tx.$queryRaw(Prisma.sql`SELECT to_char(so."completedAt",'YYYY-MM-DD') AS period,
      sum(so."totalInCents")::integer AS "grossRevenueInCents",count(*)::integer AS "sellerOrders"
      FROM seller_order so WHERE ${delivered} GROUP BY to_char(so."completedAt",'YYYY-MM-DD')`);
    const result = [];
    for (let date = from.getTime(); date < to.getTime(); date += 86400000) {
      const period = new Date(date).toISOString().slice(0, 10);
      result.push(
        rows.find((r) => r.period === period) || {
          period,
          grossRevenueInCents: 0,
          sellerOrders: 0,
        },
      );
    }
    return result;
  }
  throw new Error("No SQL oracle for dashboard endpoint");
}

async function prepareOracle(db, manifest, selection) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const result = [];
      for (const request of selection) {
        const expected = request.path.startsWith("/products")
          ? await products(tx, request.path)
          : await dashboard(tx, request, manifest);
        result.push({
          ...request,
          expected: JSON.parse(JSON.stringify(expected)),
        });
      }
      return result;
    },
    { timeout: 15000 },
  );
}

module.exports = { requests, prepareOracle };
