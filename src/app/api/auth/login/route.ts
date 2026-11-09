import { NextResponse, type NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation/user.schema";
import { authenticate } from "@/server/services/auth.service";
import { errorResponse } from "@/server/http/errors";
import { createSessionToken, REMEMBER_MAX_AGE_S, SESSION_COOKIE, SESSION_MAX_AGE_S, sessionCookieOptions } from "@/server/auth/token";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = await loginSchema.validate(body, { abortEarly: false });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
    const userId = await authenticate(email, password, ip);

    const maxAge = body.remember ? REMEMBER_MAX_AGE_S : SESSION_MAX_AGE_S;
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(userId, maxAge), sessionCookieOptions(maxAge));
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
