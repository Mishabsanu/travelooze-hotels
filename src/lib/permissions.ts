/**
 * Permission catalogue shared by the UI (menus, buttons) and the API (route guards).
 * Adding a module here makes it appear in the role permission matrix automatically.
 */

export const PERMISSION_ACTIONS = ["view", "create", "update", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_GROUPS = [
  {
    title: "Administration",
    modules: [
      { key: "user", label: "Users" },
      { key: "role", label: "Roles & Permissions" },
    ],
  },
  {
    title: "Front Office",
    modules: [
      { key: "booking", label: "Walk-in Bookings (delete = cancel / no-show)" },
      { key: "check_in_out", label: "Check-in & Check-out (update)" },
      { key: "payment", label: "Payments, Advances & Extra Charges (create = add charge, delete = remove charge)" },
      { key: "guest_id", label: "Guest Aadhaar / ID Proofs (view = open files, create = upload)" },
    ],
  },
  {
    title: "B2B Sales",
    modules: [
      { key: "agent", label: "B2B Agents Master" },
      { key: "agent_booking", label: "Agent Bookings (delete = cancel)" },
    ],
  },
  {
    title: "Property",
    modules: [
      { key: "hotel", label: "Hotels" },
      { key: "room_type", label: "Room Types & Meal Plan Rates" },
      { key: "room", label: "Rooms & Housekeeping Status" },
    ],
  },
  {
    title: "Reports",
    modules: [{ key: "report", label: "Reports (revenue, occupancy, agent outstanding)" }],
  },
] as const;

export type PermissionModule = (typeof PERMISSION_GROUPS)[number]["modules"][number]["key"];

export const PERMISSION_MODULES: PermissionModule[] = PERMISSION_GROUPS.flatMap((g) =>
  g.modules.map((m) => m.key)
);

export type ModulePermission = Record<PermissionAction, boolean>;
export type PermissionMap = Partial<Record<PermissionModule, ModulePermission>>;

export interface AccessProfile {
  isSuperAdmin: boolean;
  permissions: PermissionMap;
}

export function can(
  access: AccessProfile | null | undefined,
  module: PermissionModule,
  action: PermissionAction = "view"
): boolean {
  if (!access) return false;
  if (access.isSuperAdmin) return true;
  return Boolean(access.permissions?.[module]?.[action]);
}

/** Number of modules with at least one granted action (Super Admin = every module). */
export function grantedModuleCount(access: AccessProfile): number {
  if (access.isSuperAdmin) return PERMISSION_MODULES.length;
  return PERMISSION_MODULES.filter((m) => PERMISSION_ACTIONS.some((a) => access.permissions?.[m]?.[a])).length;
}

export function emptyPermissions():Record<PermissionModule, ModulePermission> {
  return Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { view: false, create: false, update: false, delete: false }])
  ) as Record<PermissionModule, ModulePermission>;
}

/** Keeps only known modules/actions; any create/update/delete implies view. */
export function normalizePermissions(input: unknown): Record<PermissionModule, ModulePermission> {
  const result = emptyPermissions();
  if (!input || typeof input !== "object") return result;
  const source = input as Record<string, Partial<ModulePermission> | undefined>;
  for (const mod of PERMISSION_MODULES) {
    const row = source[mod];
    if (!row) continue;
    for (const action of PERMISSION_ACTIONS) result[mod][action] = Boolean(row[action]);
    if (result[mod].create || result[mod].update || result[mod].delete) result[mod].view = true;
  }
  return result;
}
