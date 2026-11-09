import * as Yup from "yup";
import { emptyPermissions, PERMISSION_ACTIONS, PERMISSION_MODULES, type PermissionModule } from "../permissions";
import { optionalText, requiredText, statusField } from "./common";

const modulePermissionSchema = Yup.object({
  view: Yup.boolean().default(false),
  create: Yup.boolean().default(false),
  update: Yup.boolean().default(false),
  delete: Yup.boolean().default(false),
});

// Explicit shape so readBody's stripUnknown keeps known modules (a shapeless object() is emptied)
const permissionsShape = Object.fromEntries(PERMISSION_MODULES.map((m) => [m, modulePermissionSchema])) as Record<
  PermissionModule,
  typeof modulePermissionSchema
>;

export const roleSchema = Yup.object({
  name: requiredText("Role name", 60),
  description: optionalText("Description", 300),
  status: statusField,
  /** Global Access (Super Admin). Omitted = unchanged; only a Super Admin may change it (checked on the server). */
  isSuperAdmin: Yup.boolean().optional(),
  permissions: Yup.object(permissionsShape)
    .test("has-access", "Grant at least one permission", (value) => {
      const map = (value || {}) as Record<string, Record<string, boolean>>;
      return PERMISSION_MODULES.some((m) => PERMISSION_ACTIONS.some((a) => map[m]?.[a]));
    }),
});

export type RoleInput = Yup.InferType<typeof roleSchema>;

export const emptyRole = (): RoleInput => ({
  name: "",
  description: "",
  status: "active",
  isSuperAdmin: false,
  permissions: emptyPermissions(),
});
