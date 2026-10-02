import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/server/route-proxy";

export function GET(request: NextRequest) {
  return proxyBackendRequest(request, "/users/me");
}

export function PUT(request: NextRequest) {
  return proxyBackendRequest(request, "/users/");
}
