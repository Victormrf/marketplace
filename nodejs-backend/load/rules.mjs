export function selectRun(plan, scenario, stage) {
  const entry = plan.scenarios[scenario];
  const limits = plan.stages[stage];

  if (!entry || !limits) {
    throw new Error("Unknown scenario or stage");
  }
  if (entry.mode !== "read") {
    throw new Error(
      "Write scenarios are blocked until controlled fixtures/recovery in 5.2",
    );
  }
  return {
    ...limits,
    maxRequests: limits.operations * entry.requestsPerOperation,
  };
}

export function assertApiUrl(value) {
  if (value !== "http://127.0.0.1:8051") {
    throw new Error(
      "Only the dedicated native load API on 127.0.0.1:8051 is allowed",
    );
  }
  return value;
}

export function classifyResult(plan, scenario, status, body) {
  const rule = plan.scenarios[scenario];
  if (!rule) {
    return "unexpected";
  }
  if (rule.successStatuses.includes(status)) {
    return "success";
  }
  if (status === 409 && rule.expectedConflicts?.includes(body?.error)) {
    return "expected_conflict";
  }
  return "unexpected";
}

export function assertManifest(manifest, now = Date.now()) {
  assertApiUrl(manifest.apiUrl);
  if (
    manifest.profile !== "small" ||
    manifest.database !== "marketplace_scale" ||
    !manifest.runId ||
    !Array.isArray(manifest.products) ||
    manifest.products.length !== 5 ||
    manifest.products.some((p) => !p.id || !p.sellerId || !p.category) ||
    !Array.isArray(manifest.sellers) ||
    manifest.sellers.length !== 2 ||
    manifest.sellers.some((s) => !s.id || !/^token=[^;\s]+$/.test(s.cookie)) ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    now < Date.parse(manifest.createdAt) ||
    now - Date.parse(manifest.createdAt) > 45 * 60 * 1000
  ) {
    throw new Error(
      "Missing, invalid or expired read/session manifest; prepare it again",
    );
  }
}
