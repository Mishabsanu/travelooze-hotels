"use client";

import { AlertCircle, CheckCheck, ShieldCheck, XCircle } from "lucide-react";
import { useMemo } from "react";
import { PERMISSION_ACTIONS, PERMISSION_GROUPS, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import {
  ACTION_LABELS,
  countGranted,
  fullGrid,
  rowIsFull,
  setCell,
  setColumn,
  setModules,
  setRow,
  toGrid,
  TOTAL_PERMISSIONS,
  type PermissionGrid,
} from "./permissionUtils";

interface PermissionMatrixProps {
  value: unknown;
  onChange?: (next: PermissionGrid) => void;
  /** Display only (detail page): no toolbar, checkboxes not interactive. */
  readOnly?: boolean;
  /** Editable form but locked (e.g. Super Admin). */
  disabled?: boolean;
  note?: string;
  error?: string;
}

interface CheckProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

function Check({ checked, indeterminate, disabled, label, onChange }: CheckProps) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate) && !checked;
      }}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5 accent-brand cursor-pointer disabled:cursor-not-allowed align-middle"
    />
  );
}

const thClass = "px-3 py-2 border-r border-line whitespace-nowrap";

/** Role permission grid: one table per PERMISSION_GROUP, rows = modules, columns = actions. */
export function PermissionMatrix({ value, onChange, readOnly, disabled, note, error }: PermissionMatrixProps) {
  const grid = useMemo(() => toGrid(value), [value]);
  const locked = readOnly || disabled || !onChange;
  const granted = countGranted(grid);
  const emit = (next: PermissionGrid) => onChange?.(next);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            <span className="font-bold text-slate-700">{granted.permissions}</span> of {TOTAL_PERMISSIONS} permissions
            granted across <span className="font-bold text-slate-700">{granted.modules}</span> module(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => emit(fullGrid())}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md border border-brand-border bg-brand-light text-brand hover:bg-brand hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-light disabled:hover:text-brand"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Grant all
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => emit(toGrid({}))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        </div>
      )}

      {note && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-brand bg-brand-light border border-brand-border rounded-md">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          {note}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {PERMISSION_GROUPS.map((group) => {
          const modules = group.modules.map((m) => m.key) as PermissionModule[];
          const groupFull = modules.every((m) => rowIsFull(grid[m]));
          const groupAny = modules.some((m) => PERMISSION_ACTIONS.some((a) => grid[m][a]));
          const columnState = (action: PermissionAction) => ({
            all: modules.every((m) => grid[m][action]),
            any: modules.some((m) => grid[m][action]),
          });

          return (
            <div key={group.title} className="border border-line bg-white overflow-x-auto">
              <div className="px-3 py-1.5 bg-head border-b border-line text-[11px] font-bold text-brand uppercase tracking-wider">
                {group.title}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className={`${thClass} text-left`}>Module</th>
                    <th className={`${thClass} text-center w-16`}>
                      <div className="flex flex-col items-center gap-1">
                        <span>All</span>
                        <Check
                          checked={groupFull}
                          indeterminate={groupAny}
                          disabled={locked}
                          label={`All permissions for ${group.title}`}
                          onChange={(on) => emit(setModules(grid, modules, on))}
                        />
                      </div>
                    </th>
                    {PERMISSION_ACTIONS.map((action) => {
                      const col = columnState(action);
                      return (
                        <th key={action} className={`${thClass} text-center w-16 last:border-r-0`}>
                          <div className="flex flex-col items-center gap-1">
                            <span>{ACTION_LABELS[action]}</span>
                            <Check
                              checked={col.all}
                              indeterminate={col.any}
                              disabled={locked}
                              label={`${ACTION_LABELS[action]} for all ${group.title} modules`}
                              onChange={(on) => emit(setColumn(grid, modules, action, on))}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {group.modules.map(({ key, label }) => {
                    const row = grid[key];
                    const any = PERMISSION_ACTIONS.some((a) => row[a]);
                    return (
                      <tr key={key} className="hover:bg-head transition-colors">
                        <td className="px-3 py-2 border-r border-line font-semibold text-slate-800 whitespace-nowrap">{label}</td>
                        <td className="px-3 py-2 border-r border-line text-center">
                          <Check
                            checked={rowIsFull(row)}
                            indeterminate={any}
                            disabled={locked}
                            label={`All permissions for ${label}`}
                            onChange={(on) => emit(setRow(grid, key, on))}
                          />
                        </td>
                        {PERMISSION_ACTIONS.map((action) => (
                          <td key={action} className="px-3 py-2 border-r border-line last:border-r-0 text-center">
                            <Check
                              checked={row[action]}
                              disabled={locked}
                              label={`${ACTION_LABELS[action]} ${label}`}
                              onChange={(on) => emit(setCell(grid, key, action, on))}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5" role="alert">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
