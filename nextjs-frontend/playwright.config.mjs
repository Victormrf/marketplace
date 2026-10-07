import { defineConfig, devices } from "@playwright/test";
import environment from "./e2e/environment.cjs";

const { DATABASE_URL, FRONTEND_URL, BACKEND_URL } = environment;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node --require ./e2e/environment.cjs ../nodejs-backend/dist/server.js",
      url: BACKEND_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL,
        PORT: "8100",
        JWT_SECRET: "e2e-local-only-not-a-production-secret",
        NODE_ENV: "development",
      },
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname localhost --port 3100",
      url: `${FRONTEND_URL}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        BACKEND_API_URL: BACKEND_URL,
        NEXT_E2E: "1",
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
