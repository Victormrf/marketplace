"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { PrismaClient } = require("@prisma/client");
const metrics_1 = require("../observability/metrics");
const prisma = new PrismaClient({
    log: metrics_1.metrics.enabled ? [{ emit: "event", level: "query" }] : [],
});
if (metrics_1.metrics.enabled) {
    prisma.$on("query", (event) => {
        // Never read or retain query text, parameters, target or credentials.
        metrics_1.metrics.query(event.duration);
    });
}
exports.default = prisma;
