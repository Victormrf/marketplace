const { createHash } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { TABLES } = require("../scripts/scale/records");

async function fingerprintRows(tx, excluded = {}) {
  const result = {};
  for (const [, table] of TABLES) {
    const hash = createHash("sha256");
    let after = "";
    let count = 0;
    while (true) {
      const rows = await tx.$queryRaw(Prisma.sql`
          SELECT id,to_jsonb(t) AS data FROM ${Prisma.raw(`public."${table}"`)} t
          WHERE id>${after} ORDER BY id ASC LIMIT 500
        `);
      const omitted = new Set(excluded[table] || []);
      for (const row of rows) {
        if (omitted.has(row.id)) {
          continue;
        }
        hash.update(JSON.stringify(row.data));
        hash.update("\n");
        count += 1;
      }
      if (rows.length < 500) {
        break;
      }
      after = rows.at(-1).id;
    }
    result[table] = { count, sha256: hash.digest("hex") };
  }
  return result;
}

async function fingerprint(db) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return fingerprintRows(tx);
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}

module.exports = { fingerprint, fingerprintRows };
