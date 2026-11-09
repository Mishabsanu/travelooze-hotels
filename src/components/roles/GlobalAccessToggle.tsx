"use client";

import { useField, useFormikContext } from "formik";
import { Globe2 } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import type { RoleInput } from "@/lib/validation/role.schema";
import { fullGrid } from "./permissionUtils";
import { GLOBAL_ACCESS_LOCKED } from "./roleConfig";

/** "Super Admin / Global Access" switch; only a Super Admin can flip it (the API enforces this too). */
export function GlobalAccessToggle() {
  const session = useSession();
  const { setFieldValue } = useFormikContext<RoleInput>();
  const [field] = useField<boolean>("isSuperAdmin");
  const on = Boolean(field.value);
  const locked = !session.isSuperAdmin;

  const toggle = (next: boolean) => {
    void setFieldValue("isSuperAdmin", next);
    // Global Access means every permission; turning it off leaves the grid ticked to trim down
    if (next) {
      void setFieldValue("permissions", fullGrid());
      void setFieldValue("status", "active");
    }
  };

  return (
    <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between gap-4 rounded-lg border border-brand-border bg-brand-light/50 px-4 py-3">
      <div className="flex items-start gap-3">
        <Globe2 className="w-4.5 h-4.5 text-brand mt-0.5" />
        <div>
          <p className="text-xs font-bold text-slate-900">Super Admin / Global Access</p>
          <p className="text-[11px] text-slate-500">
            {locked ? GLOBAL_ACCESS_LOCKED : "Full access to every module, including modules added later."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Global Access"
        disabled={locked}
        onClick={() => toggle(!on)}
        className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          on ? "bg-brand" : "bg-slate-300"
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
