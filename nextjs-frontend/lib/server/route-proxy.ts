import { NextRequest, NextResponse } from "next/server";
import { ApiError, requestJson } from "@/lib/http";

type Endpoint =
  | "register"
  | "currentUser"
  | "updateUser"
  | "customerProfile"
  | "sellerProfile";

const endpointPaths: Record<Endpoint, string> = {
  register: "/users/register",
  currentUser: "/users/me",
  updateUser: "/users/",
  customerProfile: "/customers/",
  sellerProfile: "/sellers/",
};

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

function rejectCrossOriginMutation(request: NextRequest): NextResponse | null {
  if (!isMutation(request.method)) return null;

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin !== requestOrigin || fetchSite === "cross-site") {
    return privateJsonResponse({ message: "Cross-origin request rejected" }, 403);
  }

  return null;
}

export async function proxyProfileRequest(
  request: NextRequest,
  endpoint: Endpoint,
  method: "GET" | "POST" | "PUT",
): Promise<NextResponse> {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;

  const token = request.cookies.get("token")?.value;
  const headers = new Headers();
  if (token) headers.set("Cookie", `token=${token}`);

  const hasBody = method === "POST" || method === "PUT";
  let json: unknown;
  if (hasBody) {
    try {
      json = await request.json();
    } catch {
      return privateJsonResponse({ error: "Invalid JSON body" }, 400);
    }
  }

  try {
    const result = await requestJson<unknown>(
      `${backendBaseUrl()}${endpointPaths[endpoint]}`,
      {
        method,
        headers,
        ...(hasBody ? { json } : {}),
        cache: "no-store",
      },
    );
    return privateJsonResponse(result, method === "POST" ? 201 : 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return privateJsonResponse(
        error.body ?? { message: error.message },
        error.status,
      );
    }

    return privateJsonResponse({ message: "Backend unavailable" }, 502);
  }
}

export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  return rejectCrossOriginMutation(request);
}

export function forwardBackendUrl(): string {
  return backendBaseUrl();
}
