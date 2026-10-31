"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogging = requestLogging;
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const logger_1 = require("../utils/logger");
const requestContext_1 = require("../utils/requestContext");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only the application's literal mounts may appear in logs, never a dynamic baseUrl.
const mounts = new Set([
    "",
    "/users",
    "/customers/addresses",
    "/customers",
    "/sellers",
    "/cart",
    "/products",
    "/orders",
    "/seller-orders",
    "/dashboard",
    "/inventory",
    "/checkout",
]);
function routeTemplate(req) {
    var _a;
    const route = (_a = req.route) === null || _a === void 0 ? void 0 : _a.path;
    if (typeof route !== "string") {
        return "[unmatched]";
    }
    if (!mounts.has(req.baseUrl)) {
        return "[mounted]";
    }
    return `${req.baseUrl}${route}`;
}
function resultCode(status, closed) {
    if (closed) {
        return "HTTP_CONNECTION_CLOSED";
    }
    switch (status) {
        case 400:
            return "HTTP_BAD_REQUEST";
        case 401:
            return "HTTP_UNAUTHENTICATED";
        case 403:
            return "HTTP_FORBIDDEN";
        case 404:
            return "HTTP_NOT_FOUND";
        case 409:
            return "HTTP_CONFLICT";
        default:
            return status >= 500
                ? "HTTP_SERVER_ERROR"
                : status >= 400
                    ? "HTTP_CLIENT_ERROR"
                    : undefined;
    }
}
function requestLogging(log = logger_1.logger) {
    return (req, res, next) => {
        const received = req.header("X-Request-ID");
        const requestId = received && uuid.test(received) ? received : (0, node_crypto_1.randomUUID)();
        req.requestId = requestId;
        res.setHeader("X-Request-ID", requestId);
        const started = node_perf_hooks_1.performance.now();
        let completed = false;
        requestContext_1.requestContext.run({ requestId }, () => {
            const complete = (outcome) => {
                if (completed) {
                    return;
                }
                completed = true;
                res.off("finish", finished);
                res.off("close", closed);
                // Re-enter explicitly: socket events can originate outside this ALS chain.
                requestContext_1.requestContext.run({ requestId }, () => {
                    const level = outcome === "connection_closed" || res.statusCode >= 400
                        ? res.statusCode >= 500
                            ? "error"
                            : "warn"
                        : "info";
                    log[level]("http.completed", {
                        method: [
                            "GET",
                            "POST",
                            "PUT",
                            "PATCH",
                            "DELETE",
                            "HEAD",
                            "OPTIONS",
                        ].includes(req.method)
                            ? req.method
                            : "OTHER",
                        route: routeTemplate(req),
                        status: outcome === "connection_closed" && !res.headersSent
                            ? null
                            : res.statusCode,
                        durationMs: Math.round((node_perf_hooks_1.performance.now() - started) * 1000) / 1000,
                        outcome,
                        code: resultCode(res.statusCode, outcome === "connection_closed"),
                    });
                });
            };
            const finished = () => complete("finished");
            const closed = () => complete("connection_closed");
            res.once("finish", finished);
            res.once("close", closed);
            next();
        });
    };
}
