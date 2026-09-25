import { NextRequest } from "next/server";
import { proxyProfileRequest } from "@/lib/api/bff";

export function POST(request: NextRequest) {
  return proxyProfileRequest(request, "register", "POST");
}
