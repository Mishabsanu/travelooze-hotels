import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  hint?: string;
}

const TONES = {
  brand: "bg-brand-light text-brand border-brand-border",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
};

export function StatCard({ label, value, icon: Icon, href, tone = "brand", hint }: StatCardProps) {
  const body = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
          {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${TONES[tone]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
