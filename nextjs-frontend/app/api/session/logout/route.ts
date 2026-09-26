import { NextRequest } from "next/server";
import {
  forwardBackendUrl,
  privateJsonResponse,
  rejectCrossOrigin,
} from "@/lib/server/route-proxy";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  const token = request.cookies.get("token")?.value;
  const headers = new Headers();
  if (token) headers.set("Cookie", `token=${token}`);

  let status = 200;
  let payload: unknown = { message: "Logged out" };
  try {
    const backendResponse = await fetch(`${forwardBackendUrl()}/users/logout`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    status = backendResponse.status;
    payload = await backendResponse.json().catch(() => undefined);
  } catch {
    status = 502;
    payload = { message: "Backend unavailable; local session was cleared" };
  }

  const response = privateJsonResponse(payload, status);
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
