import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import {
  grantedModuleCount,
  normalizePermissions,
  PERMISSION_MODULES,
  type ModulePermission,
  type PermissionModule,
} from "@/lib/permissions";
import type { CreatorName, Option, Paginated, Role, SessionUser } from "@/lib/types";
import type { RoleInput } from "@/lib/validation/role.schema";
import { Role as RoleModel, type RoleDoc } from "../models/Role";
import { User } from "../models/User";
import { AppError, notFound } from "../http/errors";
import { type Filter, type ListQuery, listSort, paginate, searchFilter, statusFilter } from "../http/query";
import { toPlain } from "../utils/serialize";

const SEARCH_FIELDS = ["name", "description"];

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { nameKey: 1 },
};

type FullMap = Record<PermissionModule, ModulePermission>;

/** Super Admin always has every permission, whatever is stored on the document. */
function fullPermissions(): FullMap {
  return Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { view: true, create: true, update: true, delete: true }])
  ) as FullMap;
}

/** Who is changing roles: only a Super Admin may grant or revoke Global Access. */
export type RoleActor = Pick<SessionUser, "_id" | "isSuperAdmin">;

/** Only the creator's name is populated (never email or other user data). */
const CREATOR = { path: "createdBy", select: "name -_id" };

type LeanRole = Omit<RoleDoc, "createdBy"> & { createdBy?: unknown };

function creatorName(value: unknown): CreatorName | null {
  const name = value && typeof value === "object" ? (value as { name?: unknown }).name : undefined;
  return typeof name === "string" ? { name } : null;
}

/** Shapes a lean role for the client: effective permissions, access count, creator name, optional user count. */
function toRole(doc: LeanRole, userCount?: number): Role {
  const role = toPlain<Role & { nameKey?: string; __v?: number }>({ ...doc, createdBy: undefined });
  delete role.nameKey;
  delete role.__v;
  role.permissions = doc.isSuperAdmin ? fullPermissions() : normalizePermissions(doc.permissions);
  role.accessCount = grantedModuleCount(role);
  role.createdBy = creatorName(doc.createdBy);
  if (userCount !== undefined) role.userCount = userCount;
  return role;
}

function forbidGlobalAccess(): AppError {
  return new AppError("Only a Super Admin can grant or remove Global Access.", 403);
}

/** Active users who would still hold an active Super Admin role if `roleId` lost it. */
async function superAdminsOutside(roleId: Types.ObjectId): Promise<number> {
  const roles = await RoleModel.find({ _id: { $ne: roleId }, isSuperAdmin: true, status: "active" }).select("_id").lean();
  if (roles.length === 0) return 0;
  return User.countDocuments({ status: "active", role: { $in: roles.map((r) => r._id) } });
}

/** Number of users per role id, in one grouped query. */
async function countUsersByRole(roleIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (roleIds.length === 0) return new Map();
  const rows = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { role: { $in: roleIds } } },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listRoles(query: ListQuery): Promise<Paginated<Role>> {
  const filter: Filter = { ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  const [docs, total] = await Promise.all([
    RoleModel.find(filter)
      .sort(listSort(query, RoleModel, SORTS[query.sort] || SORTS.newest))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .populate(CREATOR)
      .lean<LeanRole[]>(),
    RoleModel.countDocuments(filter),
  ]);
  const counts = await countUsersByRole(docs.map((d) => d._id));
  return paginate(
    docs.map((d) => toRole(d, counts.get(String(d._id)) ?? 0)),
    total,
    query
  );
}

async function findRole(id: string): Promise<LeanRole> {
  if (!isValidObjectId(id)) throw notFound("Role");
  const doc = await RoleModel.findById(id).select("-__v").populate(CREATOR).lean<LeanRole>();
  if (!doc) throw notFound("Role");
  return doc;
}

export async function getRole(id: string): Promise<Role> {
  const doc = await findRole(id);
  const userCount = await User.countDocuments({ role: doc._id });
  return toRole(doc, userCount);
}

export async function createRole(input: RoleInput, actor: RoleActor): Promise<Role> {
  const isSuperAdmin = Boolean(input.isSuperAdmin);
  if (isSuperAdmin && !actor.isSuperAdmin) throw forbidGlobalAccess();
  if (isSuperAdmin && input.status !== "active") {
    throw new AppError("A Super Admin role must be active.", 409);
  }
  const doc = await RoleModel.create({
    name: input.name,
    nameKey: input.name.trim().toLowerCase(),
    description: input.description || "",
    status: input.status,
    isSuperAdmin,
    permissions: isSuperAdmin ? fullPermissions() : normalizePermissions(input.permissions),
    createdBy: actor._id,
  });
  return getRole(String(doc._id));
}

/**
 * `input.isSuperAdmin` omitted keeps the current Global Access. Granting or revoking it needs a
 * Super Admin, and revoking must leave at least one active user with Super Admin access.
 */
export async function updateRole(id: string, input: RoleInput, actor: RoleActor): Promise<Role> {
  const existing = await findRole(id);
  const isSuperAdmin = input.isSuperAdmin ?? existing.isSuperAdmin;
  if (isSuperAdmin !== existing.isSuperAdmin && !actor.isSuperAdmin) throw forbidGlobalAccess();

  if (isSuperAdmin && input.status !== "active") {
    throw new AppError("The Super Admin role cannot be deactivated.", 409);
  }
  if (existing.isSuperAdmin && !isSuperAdmin && (await superAdminsOutside(existing._id)) === 0) {
    throw new AppError("No other active user would keep Super Admin access. Grant it to another user's role first.", 409);
  }

  const update = {
    name: input.name,
    nameKey: input.name.trim().toLowerCase(),
    description: input.description || "",
    status: input.status,
    isSuperAdmin,
    // A Super Admin role always stores (and has) every permission
    permissions: isSuperAdmin ? fullPermissions() : normalizePermissions(input.permissions),
  };

  const doc = await RoleModel.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true })
    .select("-__v")
    .populate(CREATOR)
    .lean<LeanRole>();
  if (!doc) throw notFound("Role");
  const userCount = await User.countDocuments({ role: doc._id });
  return toRole(doc, userCount);
}

export async function deleteRole(id: string): Promise<void> {
  const existing = await findRole(id);
  if (existing.isSuperAdmin) {
    throw new AppError("A Super Admin role cannot be deleted. Turn off Global Access first.", 409);
  }
  const assigned = await User.countDocuments({ role: existing._id });
  if (assigned > 0) {
    throw new AppError(`${assigned} user(s) still have this role. Reassign them first.`, 409);
  }
  const deleted = await RoleModel.findByIdAndDelete(id);
  if (!deleted) throw notFound("Role");
}

/** Active roles for dropdowns. `includeInactive` is for list filters (inactive ones are labelled). */
export async function listRoleOptions({ includeInactive = false } = {}): Promise<Option[]> {
  const filter: Filter = includeInactive ? {} : { status: "active" };
  const docs = await RoleModel.find(filter).sort({ nameKey: 1 }).select("name status").limit(500).lean();
  return docs.map((d) => ({
    value: String(d._id),
    label: d.status === "active" ? d.name : `${d.name} (inactive)`,
  }));
}

/** Ids of active Global Access roles (users holding them work at every hotel). */
export async function listSuperAdminRoleIds(): Promise<string[]> {
  const docs = await RoleModel.find({ isSuperAdmin: true }).select("_id").lean();
  return docs.map((d) => String(d._id));
}
