import { NextRequest } from "next/server";
import {
  privateJsonResponse,
  proxyBackendRequest,
} from "@/lib/server/route-proxy";

type Context = {
  params: Promise<{ domain: string; path?: string[] }>;
};

function isAllowedRoute(domain: string, path: string[], method: string) {
  if (domain === "dashboard") {
    const allowedPaths = [
      "seller/summary",
      "seller/orders",
      "seller/orders/by-status",
      "seller/sales/timeseries",
      "seller/sales/by-category",
      "seller/products/top",
      "seller/customers/new",
      "seller/ratings",
    ];
    return method === "GET" && allowedPaths.includes(path.join("/"));
  }

  if (domain === "checkout") {
    return path.length === 0 && method === "POST";
  }

  if (domain === "orders") {
    if (method === "GET" && path.length <= 1) return true;
    return (
      path.length === 2 &&
      path[1] === "payment-attempts" &&
      ["GET", "POST"].includes(method)
    );
  }

  if (domain === "payment-attempts") {
    if (path.length === 1) return method === "GET";
    return (
      path.length === 2 &&
      path[1] === "refunds" &&
      ["GET", "POST"].includes(method)
    );
  }

  if (domain === "refunds") {
    return method === "GET" && path.length === 1;
  }

  if (domain === "reviews") {
    return path.length === 1 && (method === "GET" || method === "PATCH");
  }

  if (domain === "sellers") {
    return (
      path.length === 2 &&
      path[1] === "reviews" &&
      (method === "GET" || method === "POST")
    );
  }

  if (domain === "seller-orders") {
    if (method === "GET" && path.length <= 1) return true;
    if (
      path.length === 2 &&
      path[1] === "delivery" &&
      ["GET", "POST"].includes(method)
    ) {
      return true;
    }
    return (
      method === "PATCH" &&
      path.length === 2 &&
      path[1] === "status"
    );
  }

  if (domain === "deliveries") {
    if (method === "GET" && path.length === 1) return true;
    if (
      method === "GET" &&
      path.length === 2 &&
      path[1] === "history"
    ) {
      return true;
    }
    return (
      method === "PATCH" &&
      path.length === 2 &&
      ["status", "tracking"].includes(path[1])
    );
  }

  if (domain === "products") {
    if (
      path.length === 2 &&
      path[1] === "reviews" &&
      (method === "GET" || method === "POST")
    ) {
      return true;
    }

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

async function proxy(request: NextRequest, context: Context) {
  const { domain, path: routePath = [] } = await context.params;
  const path = routePath ?? [];
  if (!isAllowedRoute(domain, path, request.method)) {
    return privateJsonResponse({ error: "Not found" }, 404);
  }

  const backendPath = `/${domain}/${path
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  const idempotencyOptions =
    domain === "checkout"
      ? {
          requestHeaders: ["Idempotency-Key"] as const,
          responseHeaders: ["Idempotency-Replayed"] as const,
        }
      : {};

  return proxyBackendRequest(request, backendPath, idempotencyOptions);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
