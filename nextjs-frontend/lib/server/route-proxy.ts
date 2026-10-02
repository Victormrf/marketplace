import { NextRequest, NextResponse } from "next/server";

type ForwardableRequestHeader = "Idempotency-Key";
type ForwardableResponseHeader =
  | "Idempotency-Replayed"
  | "Set-Cookie";

type ProxyOptions = {
  requestHeaders?: readonly ForwardableRequestHeader[];
  responseHeaders?: readonly ForwardableResponseHeader[];
};

const responseHeadersToPreserve = ["Content-Type"] as const;

function backendBaseUrl(): string {
  const value = process.env.BACKEND_API_URL;
  if (!value) {
    throw new Error("BACKEND_API_URL is required on the Next.js server");
  }

  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("BACKEND_API_URL must use HTTP or HTTPS");
  }

  return parsed.toString().replace(/\/$/, "");
}

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function privateJsonResponse(
  body: unknown,
  status: number,
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  if (!isMutation(request.method)) return null;

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin !== requestOrigin || fetchSite === "cross-site") {
    return privateJsonResponse({ message: "Cross-origin request rejected" }, 403);
  }

  return null;
}

function createBackendUrl(request: NextRequest, backendPath: string): URL {
  if (
    !backendPath.startsWith("/") ||
    backendPath.startsWith("//") ||
    backendPath.includes("?") ||
    backendPath.includes("#")
  ) {
    throw new Error("Invalid internal backend path");
  }

  const pathSegments = backendPath.split("/");
  if (pathSegments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid internal backend path");
  }

  const baseUrl = backendBaseUrl();
  const target = new URL(`${baseUrl}${backendPath}`);
  target.search = request.nextUrl.search;
  return target;
}

async function readRequestBody(
  request: NextRequest,
  headers: Headers,
): Promise<BodyInit | undefined | NextResponse> {
  if (request.body === null || ["GET", "HEAD"].includes(request.method)) {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return request.formData();
  }

  if (
    contentType.toLowerCase().includes("application/json") ||
    contentType.toLowerCase().includes("+json")
  ) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return privateJsonResponse({ error: "Invalid JSON body" }, 400);
    }

    headers.set("Content-Type", "application/json");
    return JSON.stringify(body);
  }

  return privateJsonResponse({ error: "Unsupported request content type" }, 415);
}

export async function proxyBackendRequest(
  request: NextRequest,
  backendPath: string,
  options: ProxyOptions = {},
): Promise<NextResponse> {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  try {
    const url = createBackendUrl(request, backendPath);
    const headers = new Headers();
    const token = request.cookies.get("token")?.value;
    if (token) headers.set("Cookie", `token=${token}`);

    for (const name of options.requestHeaders ?? []) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const body = await readRequestBody(request, headers);
    if (body instanceof NextResponse) return body;

    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    for (const name of responseHeadersToPreserve) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    for (const name of options.responseHeaders ?? []) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    responseHeaders.set("Cache-Control", "private, no-store");
    const responseBody = [204, 205, 304].includes(upstream.status)
      ? null
      : upstream.body;

    return new NextResponse(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return privateJsonResponse({ message: "Backend unavailable" }, 502);
  }
}
