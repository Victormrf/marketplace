const { spawnSync } = require("node:child_process");

const testFiles = [
  "tests/catalog-read.integration.test.js",
  "tests/catalog-write.integration.test.js",
  "tests/inventory.integration.test.js",
  "tests/auth.integration.test.js",
  "tests/customer-address.integration.test.js",
  "tests/cart.integration.test.js",
  "tests/checkout.integration.test.js",
  "tests/orders.integration.test.js",
  "tests/payments.integration.test.js",
  "tests/refunds.integration.test.js",
  "tests/deliveries.integration.test.js",
  "tests/reviews.integration.test.js",
  "tests/dashboard.integration.test.js",
];

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, ["--test", testFile], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`Failed to start ${testFile}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
