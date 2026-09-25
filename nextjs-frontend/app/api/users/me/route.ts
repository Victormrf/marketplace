import { NextRequest } from "next/server";
import { proxyProfileRequest } from "@/lib/api/bff";

export function GET(request: NextRequest) {
  return proxyProfileRequest(request, "currentUser", "GET");
}

export function PUT(request: NextRequest) {
  return proxyProfileRequest(request, "updateUser", "PUT");
}
