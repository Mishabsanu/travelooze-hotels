import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { Paginated, SessionUser, User } from "@/lib/types";
import type { UserInput } from "@/lib/validation/user.schema";
import { hashPassword } from "../auth/password";
import { Hotel } from "../models/Hotel";
import { Role, type RoleDoc } from "../models/Role";
import { User as UserModel } from "../models/User";
import { AppError, notFound } from "../http/errors";
import { type Filter, type ListQuery, listSort, paginate, searchFilter, statusFilter } from "../http/query";
import { toPlain } from "../utils/serialize";

/** User as shown in the admin screens (adds the last sign-in time). */
export type UserRecord = User & { lastLoginAt?: string };

/** Body accepted by POST /api/users. */
export type UserCreateInput = UserInput;

/** Body accepted by PUT /api/users/:id (password optional). */
export type UserUpdateInput = Omit<UserCreateInput, "password" | "confirmPassword"> & { password?: string };

const SEARCH_FIELDS = ["name", "email", "mobile"];
const PUBLIC_FIELDS = "-__v";
/** Only the creator's name is populated: never their email, mobile or anything else. */
const CREATOR = { path: "createdBy", select: "name -_id" };

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

function roleError(message: string): AppError {
  return new AppError(message, 422, { role: message });
}

/** Who is creating / editing the user. */
export type UserActor = Pick<SessionUser, "_id" | "isSuperAdmin">;

/** Assigning a Global Access role is granting Super Admin, so only a Super Admin may do it. */
function assertMayAssign(role: RoleDoc, actor: UserActor) {
  if (role.isSuperAdmin && !actor.isSuperAdmin) {
    throw new AppError("Only a Super Admin can assign a Super Admin role.", 403, { role: "Only a Super Admin can assign this role" });
  }
}

/** Loads the role a user is being assigned to; `requireActive` blocks inactive roles. */
async function loadAssignableRole(roleId: string, requireActive: boolean): Promise<RoleDoc> {
  const role = isValidObjectId(roleId) ? await Role.findById(roleId).lean<RoleDoc>() : null;
  if (!role) throw roleError("Selected role does not exist");
  if (requireActive && role.status !== "active") throw roleError("Selected role is inactive");
  return role;
}

/** Active users holding a Super Admin role, other than `excludeId`. */
async function otherActiveSuperAdmins(excludeId: Types.ObjectId): Promise<number> {
  const superRoles = await Role.find({ isSuperAdmin: true, status: "active" }).select("_id").lean();
  if (superRoles.length === 0) return 0;
  return UserModel.countDocuments({
    _id: { $ne: excludeId },
    status: "active",
    role: { $in: superRoles.map((r) => r._id) },
  });
}

/** Hotel assignment: "All hotels" clears the list; every listed hotel must exist. */
async function hotelFields(input: Pick<UserInput, "allHotels" | "hotels">) {
  const allHotels = Boolean(input.allHotels);
  const ids = allHotels ? [] : [...new Set(input.hotels ?? [])];
  if (ids.length) {
    const found = await Hotel.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) throw new AppError("A selected hotel no longer exists", 422, { hotels: "A selected hotel no longer exists" });
  }
  return { allHotels, hotels: ids };
}

export async function listUsers(query: ListQuery): Promise<Paginated<UserRecord>> {
  const filter: Filter = { ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  const role = query.filters.role;
  if (role && isValidObjectId(role)) filter.role = new Types.ObjectId(role);

  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .sort(listSort(query, UserModel, SORTS[query.sort] || SORTS.newest))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select(PUBLIC_FIELDS)
      .populate("role", "name")
      .populate("hotels", "name")
      .populate(CREATOR)
      .lean(),
    UserModel.countDocuments(filter),
  ]);
  return paginate(toPlain<UserRecord[]>(items), total, query);
}

export async function getUser(id: string): Promise<UserRecord> {
  if (!isValidObjectId(id)) throw notFound("User");
  const doc = await UserModel.findById(id).select(PUBLIC_FIELDS).populate("role", "name").populate("hotels", "name").populate(CREATOR).lean();
  if (!doc) throw notFound("User");
  return toPlain<UserRecord>(doc);
}

export async function createUser(input: UserCreateInput, actor: UserActor): Promise<UserRecord> {
  assertMayAssign(await loadAssignableRole(input.role, true), actor);
  const doc = await UserModel.create({
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    role: input.role,
    status: input.status,
    ...(await hotelFields(input)),
    password: await hashPassword(input.password),
    createdBy: actor._id,
  });
  return getUser(String(doc._id));
}

export async function updateUser(id: string, input: UserUpdateInput, actor: SessionUser): Promise<UserRecord> {
  if (!isValidObjectId(id)) throw notFound("User");
  const existing = await UserModel.findById(id).select("role status").lean();
  if (!existing) throw notFound("User");

  const isSelf = String(existing._id) === actor._id;
  const roleChanged = String(existing.role) !== input.role;
  const newRole = await loadAssignableRole(input.role, roleChanged);
  if (roleChanged) assertMayAssign(newRole, actor);

  if (isSelf && input.status !== "active") {
    throw new AppError("You cannot deactivate your own account.", 409);
  }
  if (isSelf && roleChanged) {
    throw new AppError("You cannot change your own role.", 409);
  }

  // Never leave the system without an active Super Admin
  const currentRole = await Role.findById(existing.role).select("isSuperAdmin status").lean<RoleDoc>();
  const isActiveSuperAdmin = existing.status === "active" && currentRole?.isSuperAdmin && currentRole.status === "active";
  const losesSuperAdmin = input.status !== "active" || !newRole.isSuperAdmin;
  if (isActiveSuperAdmin && losesSuperAdmin && (await otherActiveSuperAdmins(existing._id)) === 0) {
    throw new AppError(
      "This is the last active Super Admin. Assign Super Admin to another active user first.",
      409
    );
  }

  const update: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    role: input.role,
    status: input.status,
    ...(await hotelFields(input)),
  };
  if (input.password) update.password = await hashPassword(input.password);

  const doc = await UserModel.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true })
    .select(PUBLIC_FIELDS)
    .populate("role", "name")
    .populate("hotels", "name")
    .populate(CREATOR)
    .lean();
  if (!doc) throw notFound("User");
  return toPlain<UserRecord>(doc);
}

export async function deleteUser(id: string, actor: SessionUser): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("User");
  if (id === actor._id) throw new AppError("You cannot delete your own account.", 409);
  const existing = await UserModel.findById(id).select("role status").lean();
  if (!existing) throw notFound("User");

  const role = await Role.findById(existing.role).select("isSuperAdmin status").lean<RoleDoc>();
  if (
    existing.status === "active" &&
    role?.isSuperAdmin &&
    role.status === "active" &&
    (await otherActiveSuperAdmins(existing._id)) === 0
  ) {
    throw new AppError("This is the last active Super Admin and cannot be deleted.", 409);
  }
  await UserModel.findByIdAndDelete(id);
}
