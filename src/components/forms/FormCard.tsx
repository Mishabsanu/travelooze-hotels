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
  children: ReactNode;
}

/** Card shell for every create/edit form: header with back link, body, sticky footer actions. */
export function FormCard({ title, description, badge, icon, backHref, submitLabel, submitting, children }: FormCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-3">
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

      <div className="px-4 sm:px-6 py-5 space-y-5">{children}</div>

      <div className="sticky bottom-0 z-10 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between gap-3">
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
          <button
            type="submit"
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

/** Titled group of fields inside a FormCard. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="pb-1.5 border-b border-slate-100">
        <h2 className="text-xs font-bold text-brand uppercase tracking-wider">{title}</h2>
        {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">{children}</div>
    </section>
  );
}
