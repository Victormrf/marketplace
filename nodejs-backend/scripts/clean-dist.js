const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distDirectory = path.resolve(projectRoot, "dist");
const expectedPrefix = `${projectRoot}${path.sep}`;

if (
  !distDirectory.startsWith(expectedPrefix) ||
  distDirectory === projectRoot
) {
  throw new Error("Refusing to remove an invalid dist directory");
}

fs.rmSync(distDirectory, { recursive: true, force: true });
