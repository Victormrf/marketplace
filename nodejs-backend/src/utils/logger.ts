import { trace, isSpanContextValid } from "@opentelemetry/api";
import { getRequestId } from "./requestContext";
import { CHECKOUT_CONFLICT_CODES } from "../types/checkout";

const logCodes = [
  ...CHECKOUT_CONFLICT_CODES,
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
  "INVALID_DELIVERY_JOB",
  "DATABASE_RETRYABLE_CONFLICT",
  "UNEXPECTED_DELIVERY_JOB_ERROR",
  "QUEUE_UNAVAILABLE",
  "QUEUE_PUBLICATION_FAILED",
  "WORKER_SHUTDOWN_INCOMPLETE",
  "QUEUE_SHUTDOWN_INCOMPLETE",
] as const;
export type LogCode = (typeof logCodes)[number];

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
type LogLevel = keyof typeof levels;
const events = [
  "http.completed",
  "checkout.created",
  "checkout.replayed",
  "checkout.conflict",
  "checkout.failed",
  "server.started",
  "server.stopped",
  "delivery.job.published",
  "delivery.publication.completed",
  "delivery.job.completed",
  "delivery.job.failed",
  "delivery.queue.failed",
  "delivery.worker.started",
  "delivery.worker.stopped",
  "delivery.discovery.configured",
  "delivery.discovery.removed",
  "delivery.discovery.started",
  "delivery.discovery.completed",
  "delivery.discovery.failed",
  "delivery.discovery.stopped",
] as const;
type LogEvent = (typeof events)[number];

type LogContext = {
  method?: string;
  route?: string;
  status?: number | null;
  durationMs?: number;
  outcome?: "finished" | "connection_closed";
  code?: LogCode;
  port?: number;
  jobId?: string;
  jobOutcome?: "applied" | "ignored";
  attempt?: number;
  count?: number;
};

type LogRecord = {
  timestamp: string;
  level: LogLevel;
  event: string;
  context: LogContext & {
    requestId?: string;
    traceId?: string;
    spanId?: string;
  };
};

type LogSink = (line: string, level: LogLevel) => void;

function safeContext(input: LogContext): LogContext {
  // Select primitive fields; never enumerate arbitrary request/error/Prisma objects.
  const result: LogContext = {};
  if (
    [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
      "OTHER",
    ].includes(input.method ?? "")
  ) {
    result.method = input.method;
  }
  if (
    typeof input.route === "string" &&
    input.route.length <= 200 &&
    /^(?:\/[A-Za-z0-9_/:,.*()-]*|\[unmatched\]|\[mounted\])$/.test(input.route)
  ) {
    result.route = input.route;
  }
  for (const field of ["status", "durationMs", "port"] as const) {
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
  if (
    typeof input.jobId === "string" &&
    /^delivery-progression-v1-[a-f0-9]{64}$/.test(input.jobId)
  ) {
    result.jobId = input.jobId;
  }
  if (input.jobOutcome === "applied" || input.jobOutcome === "ignored") {
    result.jobOutcome = input.jobOutcome;
  }
  for (const field of ["attempt", "count"] as const) {
    if (Number.isSafeInteger(input[field]) && input[field]! >= 0) {
      result[field] = input[field];
    }
  }
  return result;
}

export function createLogger(options: { level?: string; sink?: LogSink } = {}) {
  const configured = options.level ?? process.env.LOG_LEVEL ?? "info";
  const minimum = Object.prototype.hasOwnProperty.call(levels, configured)
    ? levels[configured as LogLevel]
    : levels.info;
  const sink: LogSink =
    options.sink ??
    ((line, level) => {
      (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
    });

  function write(level: LogLevel, event: LogEvent, context: LogContext = {}) {
    if (levels[level] < minimum) {
      return;
    }
    try {
      const active = trace.getActiveSpan()?.spanContext();
      const correlation =
        active && isSpanContextValid(active)
          ? { traceId: active.traceId, spanId: active.spanId }
          : {};
      const record: LogRecord = {
        timestamp: new Date().toISOString(),
        level,
        event: events.includes(event) ? event : "log.invalid_event",
        context: {
          ...safeContext(context),
          requestId: getRequestId(),
          ...correlation,
        },
      };
      sink(JSON.stringify(record), level);
    } catch {
      // Logging failure must not change HTTP/business results; never print raw errors.
    }
  }

  return {
    debug: (event: LogEvent, context?: LogContext) =>
      write("debug", event, context),
    info: (event: LogEvent, context?: LogContext) =>
      write("info", event, context),
    warn: (event: LogEvent, context?: LogContext) =>
      write("warn", event, context),
    error: (event: LogEvent, context?: LogContext) =>
      write("error", event, context),
  };
}

export type Logger = ReturnType<typeof createLogger>;
export const logger = createLogger();
