import { ArrowLeft, Edit2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface DetailCardProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  icon: ReactNode;
  backHref: string;
  editHref?: string;
  children: ReactNode;
}

/** Read-only record view: header with back/edit actions and grouped fields. */
export function DetailCard({ title, subtitle, badge, icon, backHref, editHref, children }: DetailCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <Link href={backHref} title="Back to list" className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-slate-900 truncate">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-mono">{subtitle}</p>}
        </div>
        {editHref && (
          <Link
            href={editHref}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-6 space-y-4">{children}</div>
    </div>
  );
}

/** A titled panel of fields (info-sheet style: label over value, thin row lines, no boxes). */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-brand">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-8 px-4 sm:grid-cols-2 lg:grid-cols-3 [&>div:last-child]:border-b-0 sm:[&>div:nth-last-child(2):nth-child(odd)]:border-b-0 lg:[&>div:nth-last-child(2):nth-child(odd)]:border-b lg:[&>div:nth-last-child(-n+3):nth-child(3n+1)]:border-b-0 lg:[&>div:nth-last-child(-n+2):nth-child(3n+2)]:border-b-0">
        {children}
      </dl>
    </section>
  );
}

export function DetailItem({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="min-w-0 border-b border-slate-100 py-2.5">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-[13px] font-semibold ${empty ? "text-slate-300" : "text-slate-900"} ${mono ? "font-mono" : ""}`}>{empty ? "—" : value}</dd>
    </div>
  );
}
