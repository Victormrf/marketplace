const fs = require("node:fs");
const path = require("node:path");

const specPath = path.resolve(__dirname, "../docs/openapi.yaml");
const document = JSON.parse(fs.readFileSync(specPath, "utf8"));
const allowedMethods = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
]);
const operationIds = new Set();

function fail(message) {
  console.error(`OpenAPI validation failed: ${message}`);
  process.exitCode = 1;
}

function resolveJsonPointer(reference) {
  if (!reference.startsWith("#/")) {
    throw new Error(`External or invalid reference: ${reference}`);
  }

  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((value, part) => value?.[part], document);
}

function inspectReferences(value, location = "document") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectReferences(item, `${location}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  if (typeof value.$ref === "string") {
    try {
      if (resolveJsonPointer(value.$ref) === undefined) {
        fail(`Unresolved ${value.$ref} at ${location}`);
      }
    } catch (error) {
      fail(`${error.message} at ${location}`);
    }
  }

  Object.entries(value).forEach(([key, child]) => {
    inspectReferences(child, `${location}.${key}`);
  });
}

if (document.openapi !== "3.0.3") {
  fail(`Expected OpenAPI 3.0.3, received ${document.openapi}`);
}

if (!document.info?.title || !document.info?.version) {
  fail("The info title and version are required");
}

if (!document.paths || Object.keys(document.paths).length === 0) {
  fail("At least one API path is required");
}

for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
  if (!route.startsWith("/")) fail(`Path must start with /: ${route}`);

  let routeHasOperation = false;
  const routeParameters = pathItem.parameters ?? [];
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!allowedMethods.has(method)) continue;
    routeHasOperation = true;

    if (!operation.operationId) {
      fail(`${method.toUpperCase()} ${route} has no operationId`);
    } else if (operationIds.has(operation.operationId)) {
      fail(`Duplicate operationId: ${operation.operationId}`);
    } else {
      operationIds.add(operation.operationId);
    }

    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      fail(`${method.toUpperCase()} ${route} has no responses`);
    }

    const declaredParameters = [
      ...routeParameters,
      ...(operation.parameters ?? []),
    ];
    const declaredPathNames = new Set(
      declaredParameters
        .map((parameter) => {
          if (parameter.$ref) {
            return resolveJsonPointer(parameter.$ref)?.name;
          }
          return parameter.name;
        })
        .filter(Boolean),
    );

    for (const [, parameterName] of route.matchAll(/\{([^}]+)\}/g)) {
      if (!declaredPathNames.has(parameterName)) {
        fail(
          `${method.toUpperCase()} ${route} has no declaration for path parameter ${parameterName}`,
        );
      }
    }
  }

  if (!routeHasOperation) fail(`Path has no HTTP operation: ${route}`);
}

inspectReferences(document);

if (process.exitCode) process.exit();

const operationCount = [...operationIds].length;
if (document["x-operation-count"] !== operationCount) {
  fail(
    `x-operation-count is ${document["x-operation-count"]}; found ${operationCount} operations`,
  );
}

if (process.exitCode) process.exit();
console.log(
  `OpenAPI 3.0.3 valid: ${Object.keys(document.paths).length} paths, ${operationCount} operations, all local references resolved.`,
);
