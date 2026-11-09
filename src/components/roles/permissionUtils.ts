import {
  emptyPermissions,
  normalizePermissions,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type ModulePermission,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/permissions";

export type PermissionGrid = Record<PermissionModule, ModulePermission>;

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
};

export const TOTAL_PERMISSIONS = PERMISSION_MODULES.length * PERMISSION_ACTIONS.length;

export function fullGrid(): PermissionGrid {
  const grid = emptyPermissions();
  for (const m of PERMISSION_MODULES) for (const a of PERMISSION_ACTIONS) grid[m][a] = true;
  return grid;
}

/** Sets one cell. Create/update/delete imply view; removing view clears the row. */
export function setCell(grid: PermissionGrid, mod: PermissionModule, action: PermissionAction, on: boolean): PermissionGrid {
  const row = { ...grid[mod] };
  if (action === "view" && !on) {
    for (const a of PERMISSION_ACTIONS) row[a] = false;
  } else {
    row[action] = on;
    if (on) row.view = true;
  }
  return { ...grid, [mod]: row };
}

export function setRow(grid: PermissionGrid, mod: PermissionModule, on: boolean): PermissionGrid {
  return { ...grid, [mod]: { view: on, create: on, update: on, delete: on } };
}

export function setColumn(
  grid: PermissionGrid,
  modules: readonly PermissionModule[],
  action: PermissionAction,
  on: boolean
): PermissionGrid {
  return modules.reduce((acc, m) => setCell(acc, m, action, on), grid);
}

export function setModules(grid: PermissionGrid, modules: readonly PermissionModule[], on: boolean): PermissionGrid {
  return modules.reduce((acc, m) => setRow(acc, m, on), grid);
}

export function rowIsFull(row: ModulePermission): boolean {
  return PERMISSION_ACTIONS.every((a) => row[a]);
}

/** Counts granted actions and modules with any access. */
export function countGranted(grid: PermissionGrid): { permissions: number; modules: number } {
  let permissions = 0;
  let modules = 0;
  for (const m of PERMISSION_MODULES) {
    const n = PERMISSION_ACTIONS.filter((a) => grid[m][a]).length;
    permissions += n;
    if (n > 0) modules += 1;
  }
  return { permissions, modules };
}

export const toGrid = (value: unknown): PermissionGrid => normalizePermissions(value);
