"use client";

import { useField } from "formik";
import { AlertCircle, Building2 } from "lucide-react";
import type { Option } from "@/lib/types";

/** "All hotels" switch + one checkbox per hotel, bound to Formik `allHotels` / `hotels`. */
export function HotelAssignField({ options, superAdminRole }: { options: Option[]; superAdminRole: boolean }) {
  const [all, , allHelpers] = useField<boolean>("allHotels");
  const [hotels, meta, helpers] = useField<string[]>("hotels");
  const error = meta.touched && typeof meta.error === "string" ? meta.error : undefined;
  const selected = new Set(hotels.value ?? []);
  const locked = superAdminRole || Boolean(all.value);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void helpers.setValue([...next]);
    void helpers.setTouched(true, false);
  };

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-3">
      <label className="flex items-center justify-between gap-4 rounded-lg border border-brand-border bg-brand-light/50 px-4 py-3 cursor-pointer">
        <span className="flex items-start gap-3">
          <Building2 className="w-4.5 h-4.5 text-brand mt-0.5" />
          <span>
            <span className="block text-xs font-bold text-slate-900">All hotels</span>
            <span className="block text-[11px] text-slate-500">
              {superAdminRole
                ? "Super Admin roles always work across every hotel."
                : "For owners, sales and accounts. Includes hotels added later."}
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          checked={superAdminRole || Boolean(all.value)}
          disabled={superAdminRole}
          onChange={(e) => void allHelpers.setValue(e.target.checked)}
          className="w-4 h-4 accent-brand"
        />
      </label>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 ${locked ? "opacity-50" : ""}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
              selected.has(o.value) && !locked ? "border-brand bg-brand-light text-brand" : "border-slate-200 bg-slate-50 text-slate-700"
            } ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={selected.has(o.value)}
              disabled={locked}
              onChange={() => toggle(o.value)}
              className="w-3.5 h-3.5 accent-brand"
            />
            {o.label}
          </label>
        ))}
        {options.length === 0 && <p className="text-xs text-slate-400">No hotels yet. Add one under Property → Hotels.</p>}
      </div>

      {error && !locked && (
        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5" role="alert">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
