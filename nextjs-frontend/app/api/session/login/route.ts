import { NextRequest } from "next/server";
import {
  privateJsonResponse,
  proxyBackendRequest,
} from "@/lib/server/route-proxy";

export async function POST(request: NextRequest) {
  const response = await proxyBackendRequest(request, "/users/login", {
    responseHeaders: ["Set-Cookie"],
  });

  if (!response.ok) return response;

  const setCookie = response.headers.get("set-cookie") ?? "";
  const token = /(?:^|;\s*)token=([^;]+)/.exec(setCookie)?.[1];
  if (!token) {
    return privateJsonResponse(
      { message: "Authentication cookie was not returned by the API" },
      502,
    );
  }

  response.headers.delete("set-cookie");
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}
