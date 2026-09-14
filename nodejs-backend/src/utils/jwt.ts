export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

export function cookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? ("none" as const) : ("lax" as const),
    maxAge: 1000 * 60 * 60 * 24,
  };
}
