const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
const path = require("node:path");

const directory = path.resolve(__dirname, "../observability/.local");
mkdirSync(directory, { recursive: true });
for (const name of ["metrics-token", "grafana-password"]) {
  const target = path.join(directory, name);
  if (!existsSync(target)) {
    writeFileSync(target, `${randomBytes(32).toString("hex")}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  }
}
console.log(
  "Local secrets ready; existing credentials preserved. Values not printed.",
);
