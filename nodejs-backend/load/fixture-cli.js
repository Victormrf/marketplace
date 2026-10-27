const { assertMemory } = require("./supervisor");
const target = require("./fixture-db");
const fixtures = require("./fixture-manager");

async function main() {
  const values = process.argv.slice(2);
  const referenceIndex = values.indexOf("--reference");
  const reference = referenceIndex >= 0;
  if (reference) {
    values.splice(referenceIndex, 1);
  }
  const modeIndex = values.indexOf("--environment");
  const mode = modeIndex >= 0 ? values.splice(modeIndex, 2)[1] : "fixture-test";
  const confirmIndex = values.indexOf("--confirm-scale-fixtures");
  const confirmation =
    confirmIndex >= 0 ? values.splice(confirmIndex, 2)[1] : undefined;
  const [operation, scenario, participants] = values;
  if (
    !["status", "reconcile", "prepare", "recover", "run"].includes(operation)
  ) {
    throw new Error(
      "Use status/reconcile, prepare <scenario> <operations> <test-confirmation>, run <stage> <scale-approval>, or recover <test-confirmation> API_AND_RUNNER_STOPPED; select scale explicitly with --environment and --confirm-scale-fixtures",
    );
  }
  if (["prepare", "recover", "run"].includes(operation)) {
    const accepted = "marketplace_load_test@127.0.0.1:5436";
    if (
      mode === "fixture-test" &&
      operation !== "run" &&
      (operation === "prepare" ? values[3] : scenario) !== accepted
    ) {
      throw new Error(
        `Explicit dedicated-test confirmation ${accepted} required`,
      );
    }
    if (!reference) {
      assertMemory();
    }
  }
  const db = target.client({ mode, confirmation, reference });
  try {
    let result;
    if (operation === "prepare") {
      result = await fixtures.prepare(db, scenario, Number(participants));
    } else if (operation === "run") {
      result = await require("./write-executor").execute(db, {
        stage: scenario,
        approval: participants,
      });
    } else if (operation === "recover") {
      result = await fixtures.recover(
        db,
        mode === "scale" ? participants || scenario : participants,
      );
    } else {
      result = await fixtures[operation](db);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
