import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { AnyObject, ObjectSchema } from "yup";
import { can, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { connectDB } from "../db";
import { loadSessionUser } from "../auth/session";
import { HOTEL_COOKIE, SESSION_COOKIE } from "../auth/token";
import { AppError, errorResponse } from "./errors";

type Guard = { module: PermissionModule; action: PermissionAction } | "authenticated";

type Ctx<P> = { params: Promise<P> };

/** Writes must come from this site (defence in depth on top of SameSite cookies). */
function isCrossSiteWrite(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

/**
 * Wraps a route handler with: DB connection, session check, permission check and error mapping.
 *   export const GET = apiHandler({ module: "customer", action: "view" }, async ({ req, user }) => ...)
 */
export function apiHandler<P = Record<string, never>>(
  guard: Guard,
  handler: (args: { req: NextRequest; user: SessionUser; params: P }) => Promise<unknown>
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (isCrossSiteWrite(req)) throw new AppError("Cross-site request blocked", 403);
      await connectDB();
      const user = await loadSessionUser(req.cookies.get(SESSION_COOKIE)?.value, req.cookies.get(HOTEL_COOKIE)?.value);
      if (!user) throw new AppError("Your session has expired. Please sign in again.", 401);
      if (guard !== "authenticated" && !can(user, guard.module, guard.action)) {
        throw new AppError("You do not have permission to perform this action", 403);
      }
      const params = ((await ctx?.params) ?? {}) as P;
      const result = await handler({ req, user, params });
      return result instanceof NextResponse ? result : NextResponse.json(result ?? { success: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Parses the JSON body and validates it with the shared Yup schema (unknown keys are stripped). */
export async function readBody<T extends AnyObject>(req: NextRequest, schema: ObjectSchema<T>): Promise<T> {
  const body = await req.json();
  return (await schema.validate(body, { abortEarly: false, stripUnknown: true })) as T;
}
