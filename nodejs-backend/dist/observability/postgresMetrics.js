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
exports.databaseMetricsTimeout = exports.databaseMetricsInterval = void 0;
exports.readPostgresSnapshot = readPostgresSnapshot;
exports.createPostgresCollector = createPostgresCollector;
const node_perf_hooks_1 = require("node:perf_hooks");
const metrics_1 = require("./metrics");
function bounded(raw, fallback, minimum, maximum) {
    const number = Number(raw);
    return Number.isInteger(number) && number >= minimum && number <= maximum
        ? number
        : fallback;
}
exports.databaseMetricsInterval = bounded(process.env.METRICS_DB_INTERVAL_MS, 30000, 10000, 300000);
exports.databaseMetricsTimeout = bounded(process.env.METRICS_DB_TIMEOUT_MS, 2000, 250, 5000);
function readPostgresSnapshot(client_1) {
    return __awaiter(this, arguments, void 0, function* (client, timeoutMs = exports.databaseMetricsTimeout) {
        return client.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            yield tx.$executeRaw `SET TRANSACTION READ ONLY`;
            yield tx.$queryRaw `SELECT set_config('statement_timeout', ${String(timeoutMs)}, true)`;
            const rows = yield tx.$queryRaw `
      SELECT count(*)::integer AS connections,
        count(*) FILTER (WHERE state = 'active' AND pid <> pg_backend_pid())::integer AS active
      FROM pg_stat_activity
      WHERE datname = current_database() AND backend_type = 'client backend'
    `;
            const snapshot = rows[0];
            if (!snapshot ||
                !Number.isInteger(snapshot.connections) ||
                !Number.isInteger(snapshot.active) ||
                snapshot.connections < 1 ||
                snapshot.active < 0 ||
                snapshot.active > snapshot.connections) {
                throw new Error("Invalid aggregate database observation");
            }
            return snapshot;
        }), { maxWait: timeoutMs, timeout: timeoutMs + 500 });
    });
}
function createPostgresCollector(collect, measurements = metrics_1.metrics, intervalMs = exports.databaseMetricsInterval) {
    let stopped = true;
    let timer;
    let pending;
    function sample() {
        if (!measurements.enabled || stopped) {
            return Promise.resolve();
        }
        if (pending) {
            return pending;
        }
        const started = node_perf_hooks_1.performance.now();
        pending = (() => __awaiter(this, void 0, void 0, function* () {
            try {
                const snapshot = yield collect();
                measurements.databaseResult(snapshot, (node_perf_hooks_1.performance.now() - started) / 1000);
            }
            catch (_a) {
                measurements.databaseResult(null, (node_perf_hooks_1.performance.now() - started) / 1000);
            }
        }))().finally(() => {
            pending = undefined;
        });
        return pending;
    }
    function tick() {
        return __awaiter(this, void 0, void 0, function* () {
            yield sample();
            if (!stopped) {
                timer = setTimeout(tick, intervalMs);
                timer.unref();
            }
        });
    }
    return {
        start() {
            if (!stopped || !measurements.enabled) {
                return;
            }
            stopped = false;
            void tick();
        },
        sample,
        stop() {
            return __awaiter(this, void 0, void 0, function* () {
                stopped = true;
                clearTimeout(timer);
                yield pending;
            });
        },
    };
}
