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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogTracing = exports.catalogTracer = void 0;
exports.traceFailure = traceFailure;
exports.catalogSpan = catalogSpan;
exports.stopTracing = stopTracing;
const api_1 = require("@opentelemetry/api");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const resources_1 = require("@opentelemetry/resources");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const client_1 = require("@prisma/client");
// Manual instrumentation deliberately avoids automatic HTTP/SQL attribute capture.
const enabled = process.env.TRACING_ENABLED === "true";
const provider = enabled
    ? new sdk_trace_node_1.NodeTracerProvider({
        resource: (0, resources_1.resourceFromAttributes)({ "service.name": "marketplace-api" }),
        spanProcessors: [
            new sdk_trace_base_1.BatchSpanProcessor(new exporter_trace_otlp_http_1.OTLPTraceExporter({
                url: (_a = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) !== null && _a !== void 0 ? _a : "http://127.0.0.1:4318/v1/traces",
                timeoutMillis: 1000,
            }), {
                maxQueueSize: 256,
                maxExportBatchSize: 32,
                scheduledDelayMillis: 1000,
                exportTimeoutMillis: 1500,
            }),
        ],
    })
    : undefined;
provider === null || provider === void 0 ? void 0 : provider.register();
exports.catalogTracer = api_1.trace.getTracer("marketplace.catalog", "1.0.0");
function traceFailure(error) {
    const code = error instanceof client_1.Prisma.PrismaClientKnownRequestError
        ? error.code
        : error instanceof client_1.Prisma.PrismaClientInitializationError
            ? error.errorCode
            : undefined;
    if (code === "P1001" || code === "P1017") {
        return "DATABASE_UNAVAILABLE";
    }
    if (["P1002", "P1008", "P2024"].includes(code !== null && code !== void 0 ? code : "")) {
        return "DATABASE_TIMEOUT";
    }
    return "OPERATION_FAILED";
}
function catalogSpan(name, operation) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!api_1.trace.getActiveSpan()) {
            return operation();
        }
        return exports.catalogTracer.startActiveSpan(name, (span) => __awaiter(this, void 0, void 0, function* () {
            try {
                return yield operation();
            }
            catch (error) {
                // Never recordException: messages, stacks and Prisma metadata can contain data.
                span.setStatus({ code: api_1.SpanStatusCode.ERROR });
                span.setAttribute("error.type", traceFailure(error));
                throw error;
            }
            finally {
                span.end();
            }
        }));
    });
}
// Only the collection entrypoints: no concrete IDs, filters, metrics or health spans.
const catalogTracing = (req, res, next) => {
    if (!enabled ||
        req.method !== "GET" ||
        !["/products", "/products/", "/products/search"].includes(req.path)) {
        next();
        return;
    }
    const route = req.path === "/products/search" ? "/products/search" : "/products/";
    const span = exports.catalogTracer.startSpan(`GET ${route}`, {
        kind: api_1.SpanKind.SERVER,
        attributes: { "http.request.method": "GET", "http.route": route },
    });
    let ended = false;
    const finish = (closed) => {
        if (ended) {
            return;
        }
        ended = true;
        if (!closed || res.headersSent) {
            span.setAttribute("http.response.status_code", res.statusCode);
        }
        if (closed || res.statusCode >= 500) {
            span.setStatus({ code: api_1.SpanStatusCode.ERROR });
            span.setAttribute("error.type", closed ? "CONNECTION_CLOSED" : "HTTP_SERVER_ERROR");
        }
        span.end();
    };
    res.once("finish", () => finish(false));
    res.once("close", () => finish(!res.writableFinished));
    api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), next);
};
exports.catalogTracing = catalogTracing;
function stopTracing() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (provider === null || provider === void 0 ? void 0 : provider.shutdown().catch(() => undefined));
    });
}
