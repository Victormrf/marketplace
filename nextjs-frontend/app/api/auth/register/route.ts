import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/server/route-proxy";

export function POST(request: NextRequest) {
  return proxyBackendRequest(request, "/users/register");
}
