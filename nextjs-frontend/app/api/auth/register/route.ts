import { NextRequest } from "next/server";
import { proxyProfileRequest } from "@/lib/server/route-proxy";

export function POST(request: NextRequest) {
  return proxyProfileRequest(request, "register", "POST");
}
