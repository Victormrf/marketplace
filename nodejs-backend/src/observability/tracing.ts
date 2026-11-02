import { context, trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { RequestHandler } from "express";
import { Prisma } from "@prisma/client";

// Manual instrumentation deliberately avoids automatic HTTP/SQL attribute capture.
const enabled = process.env.TRACING_ENABLED === "true";
const provider = enabled
  ? new NodeTracerProvider({
      resource: resourceFromAttributes({ "service.name": "marketplace-api" }),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url:
              process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
              "http://127.0.0.1:4318/v1/traces",
            timeoutMillis: 1000,
          }),
          {
            maxQueueSize: 256,
            maxExportBatchSize: 32,
            scheduledDelayMillis: 1000,
            exportTimeoutMillis: 1500,
          },
        ),
      ],
    })
  : undefined;

provider?.register();
export const catalogTracer = trace.getTracer("marketplace.catalog", "1.0.0");

export function traceFailure(error: unknown): string {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : error instanceof Prisma.PrismaClientInitializationError
        ? error.errorCode
        : undefined;
  if (code === "P1001" || code === "P1017") {
    return "DATABASE_UNAVAILABLE";
  }
  if (["P1002", "P1008", "P2024"].includes(code ?? "")) {
    return "DATABASE_TIMEOUT";
  }
  return "OPERATION_FAILED";
}

export async function catalogSpan<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!trace.getActiveSpan()) {
    return operation();
  }
  return catalogTracer.startActiveSpan(name, async (span) => {
    try {
      return await operation();
    } catch (error) {
      // Never recordException: messages, stacks and Prisma metadata can contain data.
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute("error.type", traceFailure(error));
      throw error;
    } finally {
      span.end();
    }
  });
}

// Only the collection entrypoints: no concrete IDs, filters, metrics or health spans.
export const catalogTracing: RequestHandler = (req, res, next) => {
  if (
    !enabled ||
    req.method !== "GET" ||
    !["/products", "/products/", "/products/search"].includes(req.path)
  ) {
    next();
    return;
  }
  const route =
    req.path === "/products/search" ? "/products/search" : "/products/";
  const span = catalogTracer.startSpan(`GET ${route}`, {
    kind: SpanKind.SERVER,
    attributes: { "http.request.method": "GET", "http.route": route },
  });
  let ended = false;
  const finish = (closed: boolean) => {
    if (ended) {
      return;
    }
    ended = true;
    if (!closed || res.headersSent) {
      span.setAttribute("http.response.status_code", res.statusCode);
    }
    if (closed || res.statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute(
        "error.type",
        closed ? "CONNECTION_CLOSED" : "HTTP_SERVER_ERROR",
      );
    }
    span.end();
  };
  res.once("finish", () => finish(false));
  res.once("close", () => finish(!res.writableFinished));
  context.with(trace.setSpan(context.active(), span), next);
};

export async function stopTracing() {
  await provider?.shutdown().catch(() => undefined);
}
