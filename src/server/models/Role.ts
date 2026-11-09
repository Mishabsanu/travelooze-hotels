import { model, models, Schema, type Model, type Types } from "mongoose";
import { PERMISSION_MODULES, type ModulePermission } from "@/lib/permissions";
import type { RecordStatus } from "@/lib/types";

export interface RoleDoc {
  _id: Types.ObjectId;
  name: string;
  nameKey: string;
  description?: string;
  status: RecordStatus;
  isSuperAdmin: boolean;
  permissions: Record<string, ModulePermission>;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<ModulePermission>(
  {
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
  { _id: false }
);

const permissionFields = Object.fromEntries(
  PERMISSION_MODULES.map((m) => [m, { type: PermissionSchema, default: () => ({}) }])
);

const RoleSchema = new Schema<RoleDoc>(
  {
    name: { type: String, required: true, trim: true },
    // Lower-cased copy used for case-insensitive uniqueness
    nameKey: { type: String, required: true, unique: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    isSuperAdmin: { type: Boolean, default: false },
    permissions: { type: new Schema(permissionFields, { _id: false }), default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Role: Model<RoleDoc> = (models.Role as Model<RoleDoc>) || model<RoleDoc>("Role", RoleSchema);
