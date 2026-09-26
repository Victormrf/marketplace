import { NextRequest } from "next/server";
import { proxyProfileRequest } from "@/lib/server/route-proxy";

export function GET(request: NextRequest) {
  return proxyProfileRequest(request, "currentUser", "GET");
}

export function PUT(request: NextRequest) {
  return proxyProfileRequest(request, "updateUser", "PUT");
}
