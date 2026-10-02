import { NextRequest } from "next/server";
import {
  proxyBackendRequest,
  rejectCrossOrigin,
} from "@/lib/server/route-proxy";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  const response = await proxyBackendRequest(request, "/users/logout");
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
