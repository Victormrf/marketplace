export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type JsonRequestOptions = RequestInit & {
  json?: unknown;
};

export async function requestJson<T>(
  url: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  let body: BodyInit | null | undefined = options.body;

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null
        ? "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "message" in payload && typeof payload.message === "string"
            ? payload.message
            : response.statusText
        : response.statusText;

    throw new ApiError(response.status, message || "Request failed", payload);
  }

  return payload as T;
}

export function browserRequest<T>(
  path: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  return requestJson<T>(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  }).catch((error: unknown) => {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      path !== "/api/session/login" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw error;
  });
}
