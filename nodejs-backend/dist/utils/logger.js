"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const requestContext_1 = require("./requestContext");
const checkout_1 = require("../types/checkout");
const logCodes = [
    ...checkout_1.CHECKOUT_CONFLICT_CODES,
    "DATABASE_UNAVAILABLE",
    "DATABASE_TIMEOUT",
    "UNEXPECTED_CHECKOUT_ERROR",
    "HTTP_BAD_REQUEST",
    "HTTP_UNAUTHENTICATED",
    "HTTP_FORBIDDEN",
    "HTTP_NOT_FOUND",
    "HTTP_CONFLICT",
    "HTTP_CLIENT_ERROR",
    "HTTP_SERVER_ERROR",
    "HTTP_CONNECTION_CLOSED",
];
const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const events = [
    "http.completed",
    "checkout.created",
    "checkout.replayed",
    "checkout.conflict",
    "checkout.failed",
    "server.started",
    "server.stopped",
];
function safeContext(input) {
    var _a;
    // Select primitive fields; never enumerate arbitrary request/error/Prisma objects.
    const result = {};
    if ([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
        "OTHER",
    ].includes((_a = input.method) !== null && _a !== void 0 ? _a : "")) {
        result.method = input.method;
    }
    if (typeof input.route === "string" &&
        input.route.length <= 200 &&
        /^(?:\/[A-Za-z0-9_/:,.*()-]*|\[unmatched\]|\[mounted\])$/.test(input.route)) {
        result.route = input.route;
    }
    for (const field of ["status", "durationMs", "port"]) {
        const value = input[field];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
            result[field] = value;
        }
    }
    if (input.status === null) {
        result.status = null;
    }
    if (input.outcome === "finished" || input.outcome === "connection_closed") {
        result.outcome = input.outcome;
    }
    if (input.code !== undefined && logCodes.includes(input.code)) {
        result.code = input.code;
    }
    return result;
}
function createLogger(options = {}) {
    var _a, _b, _c;
    const configured = (_b = (_a = options.level) !== null && _a !== void 0 ? _a : process.env.LOG_LEVEL) !== null && _b !== void 0 ? _b : "info";
    const minimum = Object.prototype.hasOwnProperty.call(levels, configured)
        ? levels[configured]
        : levels.info;
    const sink = (_c = options.sink) !== null && _c !== void 0 ? _c : ((line, level) => {
        (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
    });
    function write(level, event, context = {}) {
        if (levels[level] < minimum) {
            return;
        }
        try {
            const record = {
                timestamp: new Date().toISOString(),
                level,
                event: events.includes(event) ? event : "log.invalid_event",
                context: Object.assign(Object.assign({}, safeContext(context)), { requestId: (0, requestContext_1.getRequestId)() }),
            };
            sink(JSON.stringify(record), level);
        }
        catch (_a) {
            // Logging failure must not change HTTP/business results; never print raw errors.
        }
    }
    return {
        debug: (event, context) => write("debug", event, context),
        info: (event, context) => write("info", event, context),
        warn: (event, context) => write("warn", event, context),
        error: (event, context) => write("error", event, context),
    };
}
exports.logger = createLogger();
