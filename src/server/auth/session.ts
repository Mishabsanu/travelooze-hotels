import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidObjectId, Types } from "mongoose";
import { can, normalizePermissions, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { connectDB } from "../db";
import { Role, type RoleDoc } from "../models/Role";
import { User } from "../models/User";
import { readSessionToken, SESSION_COOKIE } from "./token";

/** Loads the signed-in user fresh from the DB, so deactivation or role changes apply immediately. */
export async function loadSessionUser(token?: string, activeHotel?: string): Promise<SessionUser | null> {
  const session = readSessionToken(token);
  if (!session || !isValidObjectId(session.uid)) return null;

  await connectDB();
  // One round-trip to the database (user + role together): this runs on every page and API call
  const [user] = await User.aggregate<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    status: string;
    allHotels?: boolean;
    hotels?: Types.ObjectId[];
    role?: RoleDoc;
  }>([
    { $match: { _id: new Types.ObjectId(session.uid) } },
    { $limit: 1 },
    { $project: { name: 1, email: 1, status: 1, role: 1, allHotels: 1, hotels: 1 } },
    { $lookup: { from: Role.collection.name, localField: "role", foreignField: "_id", as: "role" } },
    { $set: { role: { $first: "$role" } } },
  ]);
  if (!user || user.status !== "active") return null;
  const role = user.role;
  if (!role || role.status !== "active") return null;

  const assignedAll = role.isSuperAdmin || Boolean(user.allHotels);
  const assignedHotelIds = (user.hotels ?? []).map(String);
  // The switcher choice only narrows the scope, and only to a hotel the user is assigned to
  const active =
    activeHotel && isValidObjectId(activeHotel) && (assignedAll || assignedHotelIds.includes(activeHotel)) ? activeHotel : null;

  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    roleName: role.name,
    isSuperAdmin: role.isSuperAdmin,
    permissions: normalizePermissions(role.permissions),
    allHotels: active ? false : assignedAll,
    hotelIds: active ? [active] : assignedHotelIds,
    assignedAll,
    assignedHotelIds,
    activeHotelId: active,
  };
}

/** Current user for Server Components, deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return loadSessionUser(store.get(SESSION_COOKIE)?.value);
});

/** For pages: sends anonymous visitors to the login screen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: returns the user plus whether they hold the permission (page shows AccessDenied if not). */
export async function getPageAccess(module: PermissionModule, action: PermissionAction = "view") {
  const user = await requireUser();
  return { user, allowed: can(user, module, action) };
}

/** Mongo filter limiting a query to the hotels this user works at (ObjectIds, so it also works in aggregates). */
export function hotelScope(user: SessionUser, field = "hotel"): Record<string, unknown> {
  return user.allHotels ? {} : { [field]: { $in: user.hotelIds.map((id) => new Types.ObjectId(id)) } };
}

export function canAccessHotel(user: SessionUser, hotelId: unknown): boolean {
  return user.allHotels || user.hotelIds.includes(String(hotelId));
}

/** Mongo filter for the hotels the user is ASSIGNED to, ignoring the header switcher (hotel master list). */
export function assignedHotelScope(user: SessionUser, field = "_id"): Record<string, unknown> {
  return user.assignedAll ? {} : { [field]: { $in: user.assignedHotelIds.map((id) => new Types.ObjectId(id)) } };
}
