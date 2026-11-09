import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "hotel_session";
/** Hotel chosen in the header switcher (not a secret: access is re-checked against the user on every request) */
export const HOTEL_COOKIE = "hotel_ctx";
export const SESSION_MAX_AGE_S = 12 * 60 * 60; // 12 hours
export const REMEMBER_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days

let warned = false;
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    // Fail closed: without a real secret anyone could forge a session
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  }
  if (!warned) {
    console.warn("[auth] AUTH_SECRET not set — using a development-only secret.");
    warned = true;
  }
  return "hotel-manager-dev-only-secret-do-not-use-in-production";
}

const sign = (payload: string) => createHmac("sha256", getSecret()).update(payload).digest("base64url");

export function createSessionToken(userId: string, maxAgeS: number): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + maxAgeS * 1000 })).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string): { uid: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
