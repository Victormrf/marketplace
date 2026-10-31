"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
exports.createMetrics = createMetrics;
exports.isMetricsScrape = isMetricsScrape;
exports.metricsHandler = metricsHandler;
const prom_client_1 = require("prom-client");
const checkout_1 = require("../types/checkout");
// Instrumentation is best effort and never changes a business response.
function safely(operation) {
    try {
        operation();
        return true;
    }
    catch (_a) {
        return false;
    }
}
function createMetrics(enabled = false, processMetrics = true) {
    const registry = new prom_client_1.Registry();
    const registers = enabled ? [registry] : [];
    const completed = new prom_client_1.Counter({
        name: "marketplace_http_requests_total",
        help: "Completed HTTP responses, including 4xx and 5xx; excludes scrapes and aborted responses.",
        labelNames: ["method", "route", "status"],
        registers,
    });
    const duration = new prom_client_1.Histogram({
        name: "marketplace_http_request_duration_seconds",
        help: "HTTP duration through response finish; excludes aborted responses.",
        labelNames: ["method", "route", "status"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers,
    });
    const inFlight = new prom_client_1.Gauge({
        name: "marketplace_http_requests_in_flight",
        help: "Application requests not yet finished or closed.",
        registers,
    });
    const closed = new prom_client_1.Counter({
        name: "marketplace_http_connections_closed_total",
        help: "Requests closed before response finish; not completed HTTP responses.",
        labelNames: ["method", "route"],
        registers,
    });
    const created = new prom_client_1.Counter({
        name: "marketplace_checkout_created_total",
        help: "Checkout creations after transaction success; not replays.",
        registers,
    });
    const replayed = new prom_client_1.Counter({
        name: "marketplace_checkout_replayed_total",
        help: "Successful idempotent checkout replays, not new purchases.",
        registers,
    });
    const conflicts = new prom_client_1.Counter({
        name: "marketplace_checkout_conflicts_total",
        help: "Checkout business conflicts by safe code.",
        labelNames: ["code"],
        registers,
    });
    const failures = new prom_client_1.Counter({
        name: "marketplace_checkout_failures_total",
        help: "Unexpected checkout failures by safe classification.",
        labelNames: ["code"],
        registers,
    });
    const queries = new prom_client_1.Counter({
        name: "marketplace_prisma_queries_total",
        help: "Query events emitted by this Prisma client, including transaction control and monitoring SQL when emitted.",
        registers,
    });
    const queryDuration = new prom_client_1.Histogram({
        name: "marketplace_prisma_query_duration_seconds",
        help: "Prisma query event duration, not request or transaction duration.",
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        registers,
    });
    const connections = new prom_client_1.Gauge({
        name: "marketplace_postgres_connections",
        help: "Client sessions in the current database, including the monitoring connection; NaN when unavailable.",
        registers,
    });
    const activeSessions = new prom_client_1.Gauge({
        name: "marketplace_postgres_active_sessions",
        help: "Active sessions visible to the database role, excluding the monitoring query; NaN when unavailable.",
        registers,
    });
    const databaseUp = new prom_client_1.Gauge({
        name: "marketplace_postgres_collection_up",
        help: "1 if the last database collection succeeded, otherwise 0.",
        registers,
    });
    const databaseLastSuccess = new prom_client_1.Gauge({
        name: "marketplace_postgres_last_success_timestamp_seconds",
        help: "Unix timestamp of last successful collection; 0 before first success.",
        registers,
    });
    const collectionErrors = new prom_client_1.Counter({
        name: "marketplace_postgres_collection_errors_total",
        help: "Failed database collection attempts, without error text or SQL labels.",
        registers,
    });
    const collectionDuration = new prom_client_1.Histogram({
        name: "marketplace_postgres_collection_duration_seconds",
        help: "Collector wall duration including connection acquisition and read-only transaction setup.",
        labelNames: ["outcome"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        registers,
    });
    if (enabled) {
        connections.set(Number.NaN);
        activeSessions.set(Number.NaN);
        if (processMetrics) {
            (0, prom_client_1.collectDefaultMetrics)({ register: registry, prefix: "marketplace_" });
        }
    }
    const update = (operation) => {
        if (enabled) {
            safely(operation);
        }
    };
    return {
        enabled,
        registry,
        startHttp() {
            const counted = enabled && safely(() => inFlight.inc());
            let ended = false;
            return (result) => {
                if (ended || !enabled) {
                    return;
                }
                ended = true;
                if (counted) {
                    safely(() => inFlight.dec());
                }
                if (result.outcome === "connection_closed") {
                    update(() => closed.inc({ method: result.method, route: result.route }));
                }
                else {
                    const labels = {
                        method: result.method,
                        route: result.route,
                        status: String(result.status),
                    };
                    update(() => completed.inc(labels));
                    update(() => duration.observe(labels, result.seconds));
                }
            };
        },
        checkoutCreated: () => update(() => created.inc()),
        checkoutReplayed: () => update(() => replayed.inc()),
        checkoutConflict(code) {
            if (checkout_1.CHECKOUT_CONFLICT_CODES.includes(code)) {
                update(() => conflicts.inc({ code }));
            }
        },
        checkoutFailed(code) {
            if ([
                "DATABASE_UNAVAILABLE",
                "DATABASE_TIMEOUT",
                "UNEXPECTED_CHECKOUT_ERROR",
            ].includes(code)) {
                update(() => failures.inc({ code }));
            }
        },
        query(milliseconds) {
            if (Number.isFinite(milliseconds) && milliseconds >= 0) {
                update(() => queries.inc());
                update(() => queryDuration.observe(milliseconds / 1000));
            }
        },
        databaseResult(snapshot, seconds) {
            update(() => { var _a; return connections.set((_a = snapshot === null || snapshot === void 0 ? void 0 : snapshot.connections) !== null && _a !== void 0 ? _a : Number.NaN); });
            update(() => { var _a; return activeSessions.set((_a = snapshot === null || snapshot === void 0 ? void 0 : snapshot.active) !== null && _a !== void 0 ? _a : Number.NaN); });
            update(() => databaseUp.set(snapshot ? 1 : 0));
            update(() => collectionDuration.observe({ outcome: snapshot ? "success" : "failure" }, seconds));
            if (snapshot) {
                update(() => databaseLastSuccess.set(Date.now() / 1000));
            }
            else {
                update(() => collectionErrors.inc());
            }
        },
    };
}
exports.metrics = createMetrics(process.env.METRICS_ENABLED === "true");
function isMetricsScrape(method, path) {
    return ((method === "GET" || method === "HEAD") && /^\/metrics\/?$/i.test(path));
}
function metricsHandler(measurements = exports.metrics) {
    return (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        res.setHeader("Cache-Control", "no-store");
        if (!measurements.enabled) {
            res.sendStatus(404);
            return;
        }
        if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes((_a = req.socket.remoteAddress) !== null && _a !== void 0 ? _a : "")) {
            res.sendStatus(403);
            return;
        }
        try {
            const body = yield measurements.registry.metrics();
            res.type(measurements.registry.contentType).send(body);
        }
        catch (_b) {
            res.sendStatus(503);
        }
    });
}
