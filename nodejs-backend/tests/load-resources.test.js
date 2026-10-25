const assert = require("node:assert/strict");
const test = require("node:test");
const { statsLine, fresh } = require("../load/live-collector");

test("Docker terminal control sequences do not corrupt JSON resource values", () => {
  const json = JSON.stringify({
    Name: "marketplace-scale-postgres",
    CPUPerc: "0.03%",
    MemUsage: "38.41MiB / 7.71GiB",
  });
  const parsed = statsLine(`\x1b[H${json}\x1b[K`);
  assert.equal(parsed.cpu, 0.03);
  assert.equal(parsed.memory, 38.41 * 1024 ** 2);
  assert.equal(statsLine("\x1b[K\x1b[J"), null);
});

test("unavailable/stale/wrong-target metrics fail closed", () => {
  assert.throws(() => statsLine('{"Name":"another-container"}'));
  assert.throws(() =>
    statsLine(
      '{"Name":"marketplace-scale-postgres","CPUPerc":"N/A","MemUsage":"0B / 1GiB"}',
    ),
  );
  assert.throws(() => fresh(undefined));
  assert.throws(() => fresh(1000, 5001));
  assert.throws(() => fresh(5001, 5000));
  assert.doesNotThrow(() => fresh(1000, 5000));
});
