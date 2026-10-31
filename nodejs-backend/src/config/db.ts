const { PrismaClient } = require("@prisma/client");
import { metrics } from "../observability/metrics";

const prisma = new PrismaClient({
  log: metrics.enabled ? [{ emit: "event", level: "query" }] : [],
});

if (metrics.enabled) {
  prisma.$on("query", (event: { duration: number }) => {
    // Never read or retain query text, parameters, target or credentials.
    metrics.query(event.duration);
  });
}

export default prisma;
