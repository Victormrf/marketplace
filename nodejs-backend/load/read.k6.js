import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter, Rate } from "k6/metrics";
import {
  assertApiUrl,
  assertManifest,
  classifyResult,
  selectRun,
} from "./rules.mjs";

const plan = JSON.parse(open("./plan.json"));
if (__ENV.AUTHORIZE_READ !== "marketplace_scale-small") {
  throw new Error(
    "Explicit AUTHORIZE_READ=marketplace_scale-small is required; do not run in 5.1",
  );
}
const scenario = __ENV.SCENARIO || "catalog";
const stage = __ENV.STAGE || "smoke";
const limits = selectRun(plan, scenario, stage);
const api = assertApiUrl(__ENV.API_URL || plan.apiUrl);
const manifest = JSON.parse(open("./.local/read-manifest.json"));
assertManifest(manifest);

const unexpected = new Rate("unexpected_results");
const business = new Counter("business_results");

export const options = {
  scenarios: {
    bounded: {
      executor: "shared-iterations",
      vus: limits.vus,
      iterations: limits.operations,
      maxDuration: `${limits.maxDurationSeconds}s`,
      gracefulStop: "0s",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "p(95)", "p(99)", "max"],
  thresholds: {
    unexpected_results: [
      {
        threshold: `rate<${plan.hypotheses.unexpectedRate}`,
        abortOnFail: true,
      },
    ],
    http_req_duration: [
      `p(95)<${plan.hypotheses.p95Ms}`,
      `p(99)<${plan.hypotheses.p99Ms}`,
    ],
    checks: ["rate==1"],
  },
};

function get(path, name, cookie, valid) {
  const response = http.get(`${api}${path}`, {
    timeout: `${plan.http.timeoutSeconds}s`,
    redirects: 0,
    headers: cookie ? { Cookie: cookie } : {},
    tags: { name, journey: scenario },
  });
  let body;
  try {
    body = response.json();
  } catch {
    body = null;
  }
  const correct =
    classifyResult(plan, scenario, response.status, body) === "success" &&
    valid(body);
  unexpected.add(!correct);
  business.add(1, { result: correct ? "success" : "unexpected" });
  check(correct, {
    "status and DTO match the read contract": (value) => value,
  });
  if (!correct) {
    exec.test.abort(`Unexpected result for ${name}: HTTP ${response.status}`);
  }
}

export default function () {
  const iteration = exec.scenario.iterationInTest;
  const product = manifest.products[iteration % manifest.products.length];
  if (scenario === "catalog") {
    const queries = [
      "page=1&limit=20",
      `search=Scale&sellerId=${encodeURIComponent(product.sellerId)}&category=${product.category}&inStock=true&page=1&limit=5`,
      `search=Scale&sellerId=${encodeURIComponent(product.sellerId)}&category=${product.category}&inStock=true&page=2&limit=5`,
      "inStock=false&page=1&limit=20",
    ];
    get(
      `/products?${queries[iteration % queries.length]}`,
      "catalog/list",
      null,
      (body) => {
        return (
          Array.isArray(body?.data) && Number.isInteger(body.pagination?.total)
        );
      },
    );
  } else if (scenario === "product") {
    get(`/products/${product.id}`, "product/detail", null, (body) => {
      return (
        body?.id === product.id &&
        Number.isInteger(body.priceInCents) &&
        body.currency === "BRL"
      );
    });
  } else if (scenario === "dashboard") {
    const seller = manifest.sellers[iteration % manifest.sellers.length];
    const range = `from=${plan.dashboardRange.from}&to=${plan.dashboardRange.to}`;
    for (const definition of plan.scenarios.dashboard.paths) {
      const path = definition.slice(4);
      const extra = path.endsWith("/orders")
        ? "&page=1&limit=20&status=DELIVERED"
        : "";
      get(`${path}?${range}${extra}`, path, seller.cookie, (body) => {
        if (path.endsWith("/summary")) {
          return (
            Number.isInteger(body?.grossRevenueInCents) &&
            body.currency === "BRL"
          );
        }
        if (path.endsWith("/ratings")) {
          return (
            Number.isInteger(body?.totalReviews) && body.distribution != null
          );
        }
        return path.endsWith("/orders")
          ? Array.isArray(body?.data)
          : Array.isArray(body);
      });
    }
  }
  sleep(plan.http.thinkSeconds);
}
