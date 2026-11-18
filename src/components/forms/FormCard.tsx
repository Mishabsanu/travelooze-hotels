"use client";

import { ArrowLeft, Info, Save } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface FormCardProps {
  title: string;
  description?: string;
  badge?: string;
  icon: ReactNode;
  backHref: string;
  submitLabel: string;
  submitting?: boolean;
  /** Extra button(s) shown left of the main submit button, e.g. "Save & Check In" */
  extraActions?: ReactNode;
  /** Runs when the main submit button is clicked (before the form submits) */
  onSubmitClick?: () => void;
  /** Right-hand panel on wide screens (e.g. the price summary), below the form on small ones */
  aside?: ReactNode;
  children: ReactNode;
}

/** Card shell for every create/edit form: header with back link, body, sticky footer actions. */
export function FormCard({ title, description, badge, icon, backHref, submitLabel, submitting, extraActions, onSubmitClick, aside, children }: FormCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-clip">
      <div className="px-3 sm:px-4 py-3 border-b border-slate-200 flex items-center gap-3">
        <Link
          href={backHref}
          title="Back to list"
          className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">{title}</h1>
            {badge && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>

      {aside ? (
        <div className="px-3 sm:px-4 py-4 bg-slate-50/50 xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-4 space-y-4 xl:space-y-0">
          <div className="space-y-4 min-w-0">{children}</div>
          <div className="xl:sticky xl:top-[144px] self-start">{aside}</div>
        </div>
      ) : (
        <div className="px-3 sm:px-4 py-4 bg-slate-50/50 space-y-4">{children}</div>
      )}

      <div className="sticky bottom-0 z-10 px-3 sm:px-4 py-3 bg-slate-50/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4 text-brand" />
          <span>
            Fields marked with (<span className="text-rose-500 font-bold">*</span>) are required.
          </span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Link
            href={backHref}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition border border-slate-300"
          >
            Cancel
          </Link>
          {extraActions}
          <button
            type="submit"
            onClick={onSubmitClick}
            disabled={submitting}
            className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{submitting ? "Saving..." : submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Titled group of fields inside a FormCard: a white card with a numbered title bar ("1 · Guest" → ① Guest). */
const COLS = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
} as const;

export function FormSection({ title, description, action, cols = 4, children }: { title: string; description?: string; action?: ReactNode; cols?: keyof typeof COLS; children: ReactNode }) {
  const m = title.match(/^(\d+)\s*·\s*(.*)$/);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-100">
        {m && <span className="w-6 h-6 shrink-0 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">{m[1]}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800">{m ? m[2] : title}</h2>
          {description && <p className="text-[11px] text-slate-500">{description}</p>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={`p-4 grid ${COLS[cols]} gap-x-4 gap-y-3`}>{children}</div>
    </section>
  );
}
