export const ROLE_UI = {
  label: "Role",
  plural: "Roles & Permissions",
  basePath: "/dashboard/admin/roles",
  apiBase: "/api/roles",
  description: "Define roles and what each one can view, create, update and delete",
} as const;

export const SUPER_ADMIN_NOTE = "Global Access is on: this role has full access to every module and must stay active.";

export const GLOBAL_ACCESS_LOCKED = "Only a Super Admin can turn Global Access on or off.";
