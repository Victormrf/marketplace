import { test } from "node:test";
import assert from "node:assert/strict";
import environment from "../e2e/environment.cjs";

test("E2E guard rejects development, remote and redirected database targets", () => {
  const { DATABASE_URL, assertTestDatabase } = environment;
  assert.equal(assertTestDatabase(DATABASE_URL), DATABASE_URL);
  for (const target of [
    "postgresql://marketplace_dev:password@localhost:5433/marketplace_dev",
    DATABASE_URL.replace("marketplace_e2e", "marketplace_dev"),
    DATABASE_URL.replace("127.0.0.1", "remote.invalid"),
    DATABASE_URL.replace("5434", "5433"),
    `${DATABASE_URL}?schema=other`,
  ]) {
    assert.throws(
      () => assertTestDatabase(target),
      /dedicated authorized target/,
    );
  }
});
