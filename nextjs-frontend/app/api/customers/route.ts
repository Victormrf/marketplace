import { NextRequest } from "next/server";
import { proxyProfileRequest } from "@/lib/api/bff";

export function GET(request: NextRequest) {
  return proxyProfileRequest(request, "customerProfile", "GET");
}

export function POST(request: NextRequest) {
  return proxyProfileRequest(request, "customerProfile", "POST");
}

export function PUT(request: NextRequest) {
  return proxyProfileRequest(request, "customerProfile", "PUT");
}
