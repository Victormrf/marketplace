const { assertMemory } = require("./supervisor");
const target = require("./fixture-db");
const fixtures = require("./fixture-manager");

async function main() {
  const [operation, scenario, participants, confirmation] =
    process.argv.slice(2);
  if (!["status", "reconcile", "prepare", "recover"].includes(operation)) {
    throw new Error(
      "Use status/reconcile, prepare <scenario> <participants> <confirmation>, or recover <confirmation> API_AND_RUNNER_STOPPED",
    );
  }
  if (["prepare", "recover"].includes(operation)) {
    const accepted = "marketplace_load_test@127.0.0.1:5436";
    if ((operation === "prepare" ? confirmation : scenario) !== accepted) {
      throw new Error(
        `Explicit dedicated-test confirmation ${accepted} required`,
      );
    }
    assertMemory(); // 2 GiB; never the read-smoke relaxation.
  }
  const db = target.client();
  try {
    let result;
    if (operation === "prepare") {
      result = await fixtures.prepare(db, scenario, Number(participants));
    } else if (operation === "recover") {
      result = await fixtures.recover(db, participants);
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
