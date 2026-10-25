import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter, Rate } from "k6/metrics";
import {
  assertApiUrl,
  assertManifest,
  classifyResult,
  selectRun,
  containsExpected,
} from "./rules.mjs";

const plan = JSON.parse(open("./plan.json"));
if (
  __ENV.AUTHORIZE_READ !== "marketplace_scale-small" ||
  __ENV.SUPERVISED_READ !== "verified-local-run"
) {
  throw new Error(
    "Use the supervised load:read runner; direct unsupervised execution is disabled",
  );
}
const scenario = __ENV.SCENARIO || "catalog";
const stage = __ENV.STAGE || "smoke";
const limits = selectRun(plan, scenario, stage);
const api = assertApiUrl(__ENV.API_URL || plan.apiUrl);
const manifest = JSON.parse(open("./.local/read-manifest.json"));
assertManifest(manifest);
const prepared = JSON.parse(open("./.local/read-oracle.json"));
if (!Array.isArray(prepared) || prepared.length < 1 || prepared.length > 5) {
  throw new Error("Missing or invalid bounded SQL oracle");
}

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
  const request = prepared[iteration % prepared.length];
  const cookie =
    request.sellerIndex === undefined
      ? null
      : manifest.sellers[request.sellerIndex].cookie;
  get(request.path, request.tag, cookie, (body) =>
    containsExpected(body, request.expected),
  );
  sleep(plan.http.thinkSeconds);
}
