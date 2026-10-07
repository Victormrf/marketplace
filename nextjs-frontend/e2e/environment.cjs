const path = require("node:path");

const DATABASE_URL =
  "postgresql://marketplace_e2e:e2e_local_only@127.0.0.1:5434/marketplace_e2e";
const FRONTEND_URL = "http://localhost:3100";
const BACKEND_URL = "http://127.0.0.1:8100";
const backendDirectory = path.resolve(__dirname, "../../nodejs-backend");

function assertTestDatabase(value = DATABASE_URL) {
  const target = new URL(value);
  if (
    target.protocol !== "postgresql:" ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "5434" ||
    target.pathname !== "/marketplace_e2e" ||
    target.username !== "marketplace_e2e" ||
    target.password !== "e2e_local_only" ||
    target.search !== ""
  ) {
    throw new Error(
      "E2E refused: database is not the dedicated authorized target",
    );
  }
  return value;
}

// Executed before importing Prisma, the application, or running migrations.
assertTestDatabase(process.env.DATABASE_URL ?? DATABASE_URL);

module.exports = {
  DATABASE_URL,
  FRONTEND_URL,
  BACKEND_URL,
  backendDirectory,
  assertTestDatabase,
};
