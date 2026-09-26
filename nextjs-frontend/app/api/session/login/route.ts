import { NextRequest } from "next/server";
import {
  forwardBackendUrl,
  privateJsonResponse,
  rejectCrossOrigin,
} from "@/lib/server/route-proxy";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return privateJsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    const backendResponse = await fetch(`${forwardBackendUrl()}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
      cache: "no-store",
    });
    const payload: unknown = await backendResponse.json().catch(() => ({}));
    const response = privateJsonResponse(payload, backendResponse.status);

    if (!backendResponse.ok) return response;

    const setCookie = backendResponse.headers.get("set-cookie") ?? "";
    const token = /(?:^|;\s*)token=([^;]+)/.exec(setCookie)?.[1];
    if (!token) {
      return privateJsonResponse(
        { message: "Authentication cookie was not returned by the API" },
        502,
      );
    }

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch {
    return privateJsonResponse({ message: "Backend unavailable" }, 502);
  }
}
