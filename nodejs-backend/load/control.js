const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const database = require("../scripts/scale/database");
const {
  DEFAULT_URL,
  assertTarget,
  inspectContainer,
  measureStorage,
  assertBudget,
} = require("../scripts/scale/environment");
const { config } = require("../scripts/scale/planner");
const plan = require("./plan.json");
const BACKEND = path.resolve(__dirname, "..");

function machine() {
  return {
    node: process.version,
    platform: os.platform(),
    architecture: os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    availableParallelism: os.availableParallelism(),
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
  };
}

function assertBaseline(control) {
  if (
    control.state !== "completed" ||
    control.report?.profile !== "small" ||
    control.report?.insertedTotal !== config.profiles.small.totalRows
  ) {
    throw new Error(
      "A completed small baseline is required; do not generate/purge automatically",
    );
  }
}

async function preflight(db) {
  inspectContainer();
  const control = await database.identify(db);
  assertBaseline(control);
  const counts = await database.countRows(db);
  for (const [table, expected] of Object.entries(control.report.inserted)) {
    if (counts[table] !== expected) {
      throw new Error(
        `Baseline has changed: ${table}; stop and review before any experiment`,
      );
    }
  }
  assertBudget(
    await measureStorage(db),
    config.executionPolicy,
    config.profiles.small.limits,
    0,
    0,
    0,
  );
  if (os.freemem() < plan.stopPolicy.minimumAvailableMemoryBytes) {
    throw new Error(
      "Less than 2 GiB host memory available; postpone the experiment",
    );
  }
  return control;
}

async function prepareReadManifest(db, control) {
  const discovered = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const products = await tx.$queryRaw`
      SELECT p.id, p."sellerId", p.category, count(oi.id)::integer AS "historicalLines"
      FROM product p LEFT JOIN order_item oi ON oi."productId"=p.id
      WHERE p."isActive"=true
      GROUP BY p.id ORDER BY count(oi.id) DESC,p.id ASC LIMIT 5
    `;
    const ranked = await tx.$queryRaw`
      SELECT s.id,u.id AS "userId",u.email,count(so.id)::integer AS sales
      FROM seller s JOIN "user" u ON u.id=s."userId"
      LEFT JOIN seller_order so ON so."sellerId"=s.id
      WHERE u."isActive"=true
      GROUP BY s.id,u.id,u.email ORDER BY count(so.id) DESC,s.id ASC
    `;
    if (products.length !== 5 || ranked.length < 2) {
      throw new Error("Insufficient baseline products/sellers");
    }
    return { products, sellers: [ranked[0], ranked.at(-1)] };
  });

  const sellers = [];
  for (const seller of discovered.sellers) {
    const response = await fetch(`${plan.apiUrl}/users/login`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: seller.email,
        password: "scale-local-only",
      }),
    });
    const match = response.headers
      .get("set-cookie")
      ?.match(/(?:^|,\s*)token=([^;]+)/);
    if (response.status !== 200 || !match) {
      throw new Error("Scale session preparation failed; no automatic retry");
    }
    const cookie = `token=${match[1]}`;
    const identity = await fetch(`${plan.apiUrl}/users/me`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    const user = identity.status === 200 ? await identity.json() : null;
    if (user?.id !== seller.userId || user?.role !== "SELLER") {
      throw new Error("Authenticated identity differs from the scale database");
    }
    sellers.push({ ...seller, cookie });
  }

  const manifest = {
    apiUrl: plan.apiUrl,
    database: "marketplace_scale",
    profile: "small",
    runId: control.run_id,
    createdAt: new Date().toISOString(),
    products: discovered.products,
    sellers,
    machine: machine(),
  };
  const { assertManifest } = await import("./rules.mjs");
  assertManifest(manifest);
  const directory = path.join(__dirname, ".local");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "read-manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  console.log(
    "Read manifest prepared locally; cookies omitted from output. Valid for 45 minutes.",
  );
}

function serve() {
  const entry = path.join(BACKEND, "dist/server.js");
  if (!fs.existsSync(entry)) {
    throw new Error("Compiled backend missing; execute npm run build first");
  }
  const env = {
    ...process.env,
    PORT: "8051",
    NODE_ENV: "production",
    DATABASE_URL: `${assertTarget(process.env.SCALE_DATABASE_URL || DEFAULT_URL)}?connection_limit=5&pool_timeout=10`,
    JWT_SECRET: randomBytes(48).toString("hex"),
    CLOUDINARY_CLOUD_NAME: "scale-disabled",
    CLOUDINARY_API_KEY: "scale-disabled",
    CLOUDINARY_API_SECRET: "scale-disabled",
  };
  const child = spawn(process.execPath, [entry], {
    cwd: BACKEND,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  const stop = () => child.kill("SIGINT");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    process.exitCode = code ?? 1;
  });
  console.log(
    "Dedicated compiled API: http://127.0.0.1:8051. No data preparation or cleanup is automatic.",
  );
}

async function main() {
  const operation = process.argv[2] || "plan";
  if (operation === "plan") {
    console.log(
      JSON.stringify(
        { plan, machine: machine(), executedRequests: 0 },
        null,
        2,
      ),
    );
    return;
  }
  if (
    !["serve", "sessions"].includes(operation) ||
    process.argv[3] !== "--confirm-scale"
  ) {
    throw new Error(
      "Use plan, or serve/sessions --confirm-scale only during 5.2",
    );
  }
  assertTarget(process.env.SCALE_DATABASE_URL || DEFAULT_URL);
  const db = database.client();
  try {
    const control = await preflight(db);
    if (operation === "sessions") {
      await prepareReadManifest(db, control);
    }
  } finally {
    await db.$disconnect();
  }
  if (operation === "serve") {
    serve();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertBaseline, machine };
