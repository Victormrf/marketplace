type HttpError = {
  status: number;
  body?: unknown;
};

function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  );
}

export function isIdempotencyProcessingConflict(error: unknown): boolean {
  if (!isHttpError(error) || error.status !== 409) {
    return false;
  }

  if (typeof error.body !== "object" || error.body === null) {
    return false;
  }

  const body = error.body;
  const message =
    "error" in body && typeof body.error === "string"
      ? body.error
      : "message" in body && typeof body.message === "string"
        ? body.message
        : null;

  return message?.trim().toLowerCase() === "idempotency key is processing";
}

export function shouldClearPendingAttempt(error: unknown): boolean {
  return (
    isHttpError(error) &&
    error.status >= 400 &&
    error.status < 500 &&
    !isIdempotencyProcessingConflict(error)
  );
}
