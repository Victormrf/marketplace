import { NextRequest, NextResponse } from "next/server";
import { ApiError, requestJson } from "@/lib/http";
import { rejectCrossOrigin } from "@/lib/server/route-proxy";

type Context = {
  params: Promise<{ domain: string; path?: string[] }>;
};

function isAllowedRoute(domain: string, path: string[], method: string) {
  if (domain === "products") {
    if (method === "GET") {
      return (
        path.length === 0 ||
        path.length === 1 ||
        (path.length === 2 && ["category", "seller"].includes(path[0]))
      );
    }

    if (method === "POST") return path.length === 0;
    if (method === "PUT" || method === "DELETE") return path.length === 1;
    return false;
  }

  if (domain === "inventory") {
    if (path.length === 2 && path[0] === "products" && method === "GET") {
      return true;
    }
    if (
      path.length === 3 &&
      path[0] === "products" &&
      path[2] === "movements" &&
      method === "GET"
    ) {
      return true;
    }
    return (
      path.length === 3 &&
      path[0] === "products" &&
      ["restock", "adjustments"].includes(path[2]) &&
      method === "POST"
    );
  }

  if (domain === "customers") {
    if (path[0] !== "addresses") return false;
    if (path.length === 1) return method === "GET" || method === "POST";
    if (path.length === 2) {
      return ["GET", "PUT", "DELETE"].includes(method);
    }
    return path.length === 3 && path[2] === "default" && method === "PUT";
  }

  if (domain === "cart") {
    if (path.length === 0) return method === "GET";
    if (path.length === 1 && path[0] === "items") {
      return method === "POST" || method === "DELETE";
    }
    return (
      path.length === 2 &&
      path[0] === "items" &&
      ["PUT", "DELETE"].includes(method)
    );
  }

  return false;
}

function apiBaseUrl() {
  const value = process.env.BACKEND_API_URL;
  if (!value) throw new Error("BACKEND_API_URL is required");
  return new URL(value).toString().replace(/\/$/, "");
}

async function proxy(request: NextRequest, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { domain, path: routePath = [] } = await context.params;
  const path = routePath ?? [];
  if (!isAllowedRoute(domain, path, request.method)) {
    const response = NextResponse.json({ error: "Not found" }, { status: 404 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const url = `${apiBaseUrl()}/${domain}/${path
    .map(encodeURIComponent)
    .join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const token = request.cookies.get("token")?.value;
  if (token) headers.set("Cookie", `token=${token}`);
  try {
    let result: unknown;
    if (request.method === "GET" || request.method === "DELETE") {
      result = await requestJson<unknown>(url, {
        method: request.method,
        headers,
        cache: "no-store",
      });
    } else if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: form,
        cache: "no-store",
      });
      const payload =
        response.status === 204
          ? undefined
          : await response.json().catch(() => undefined);
      if (!response.ok) throw new ApiError(response.status, "Backend request failed", payload);
      result = payload;
    } else {
      result = await requestJson<unknown>(url, {
        method: request.method,
        headers,
        json: await request.json(),
        cache: "no-store",
      });
    }
    const response =
      result === undefined
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(result, {
            status:
              request.method === "POST" &&
              ((domain === "customers" && path[0] === "addresses") ||
                (domain === "cart" && path[0] === "items"))
                ? 201
                : 200,
          });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    const body =
      error instanceof ApiError
        ? error.body ?? { message: error.message }
        : { message: "Backend unavailable" };
    const response = NextResponse.json(body, { status });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
