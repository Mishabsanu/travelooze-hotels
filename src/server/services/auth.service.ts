import "server-only";
import { connectDB } from "../db";
import { Role, type RoleDoc } from "../models/Role";
import { User } from "../models/User";
import { verifyPassword } from "../auth/password";
import { escapeRegex } from "../http/query";
import { AppError } from "../http/errors";

// ─── Login rate limit (per server instance) ──────────────────────────────────
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

function lockedMinutes(key: string): number {
  const f = failures.get(key);
  if (!f) return 0;
  if (f.until < Date.now()) {
    failures.delete(key);
    return 0;
  }
  return f.count >= MAX_FAILURES ? Math.ceil((f.until - Date.now()) / 60000) : 0;
}

function recordFailure(key: string) {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count++;
}

/** Signs in with email or mobile number. Returns the user id on success. */
export async function authenticate(identifier: string, password: string, clientIp: string): Promise<string> {
  const id = identifier.trim();
  const key = `${clientIp}|${id.toLowerCase()}`;
  const minutes = lockedMinutes(key);
  if (minutes) {
    throw new AppError(`Too many failed attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`, 429);
  }

  await connectDB();
  const conditions: Record<string, unknown>[] = [{ email: id.toLowerCase() }];
  const digits = id.replace(/\D/g, "");
  if (!id.includes("@") && digits.length >= 7) {
    // Match on the last 8 digits so "+974 5555 1234" and "55551234" both work
    const suffix = digits.slice(-8).split("").map(escapeRegex).join("[\\s\\-()]*");
    conditions.push({ mobile: { $regex: `${suffix}$` } });
  }

  const user = await User.findOne({ $or: conditions }).select("+password status role");
  if (!user || !(await verifyPassword(password, user.password))) {
    recordFailure(key);
    throw new AppError("Invalid email/mobile or password", 401);
  }
  if (user.status !== "active") {
    throw new AppError("This account is inactive. Please contact your administrator.", 403);
  }
  const role = await Role.findById(user.role).select("status").lean<RoleDoc>();
  if (!role || role.status !== "active") {
    throw new AppError("Your role is inactive. Please contact your administrator.", 403);
  }

  failures.delete(key);
  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  return String(user._id);
}
