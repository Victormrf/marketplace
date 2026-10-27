export function selectRun(plan, scenario, stage) {
  const entry = plan.scenarios[scenario];
  const limits =
    stage === "reference" ? plan.reducedBaseline.read : plan.stages[stage];

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
    maxRequests:
      stage === "reference"
        ? limits.operations
        : limits.operations * entry.requestsPerOperation,
  };
}

export function assertAuthorizedRead(plan, scenario, variant, stage, endpoint) {
  const allowed = plan.currentAuthorization;
  const single = allowed?.singleReads?.find(
    (item) =>
      item.scenario === scenario &&
      item.variant === variant &&
      item.stage === stage &&
      item.endpoint === endpoint,
  );
  if (
    allowed?.automaticAdvance === false &&
    single?.scenario === scenario &&
    single.variant === variant &&
    single.stage === stage &&
    (stage !== "reference" || plan.reducedBaseline.enabled) &&
    /^[a-zA-Z0-9.-]+$/.test(single.id)
  ) {
    return single.id;
  }
  if (
    !allowed ||
    allowed.automaticAdvance !== false ||
    !allowed.readScenarios.includes(scenario) ||
    !allowed.stages.includes(stage)
  ) {
    throw new Error(
      "Read round is not explicitly authorized; no automatic advance is allowed",
    );
  }
}

export function assertApiUrl(value) {
  if (value !== "http://127.0.0.1:8051") {
    throw new Error(
      "Only the dedicated native load API on 127.0.0.1:8051 is allowed",
    );
  }
  return value;
}

export function memoryPolicy(plan, scenario, stage) {
  if (
    stage === "reference" &&
    plan.reducedBaseline.enabled &&
    ["product", "dashboard", ...plan.reducedBaseline.writeScenarios].includes(
      scenario,
    )
  ) {
    return {
      ...plan.stopPolicy,
      minimumStartAvailableMemoryBytes:
        plan.reducedBaseline.minimumStartAvailableMemoryBytes,
      minimumAvailableMemoryBytes:
        plan.reducedBaseline.minimumAvailableMemoryBytes,
    };
  }
  if (stage === "smoke" && plan.scenarios[scenario]?.mode === "read") {
    return { ...plan.stopPolicy, ...plan.readSmokeMemory };
  }
  return { ...plan.stopPolicy };
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

// SQL oracles specify the relevant public fields; unexpected extra DTO fields
// are not performance failures, but every expected field and array position is checked.
export function containsExpected(actual, expected) {
  if (expected === null || typeof expected !== "object") {
    return actual === expected;
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => containsExpected(actual[index], value))
    );
  }
  return (
    actual !== null &&
    typeof actual === "object" &&
    Object.entries(expected).every(([key, value]) =>
      containsExpected(actual[key], value),
    )
  );
}
