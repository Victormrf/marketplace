"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireJwtSecret = requireJwtSecret;
exports.cookieOptions = cookieOptions;
function requireJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is required");
    return secret;
}
function cookieOptions() {
    const production = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: production,
        sameSite: production ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24,
    };
}
