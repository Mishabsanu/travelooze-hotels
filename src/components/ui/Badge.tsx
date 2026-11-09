import { clsx } from "clsx";
import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const VARIANTS: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  brand: "bg-brand-light text-brand border-brand-border",
};

const DOTS: Record<BadgeVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
  brand: "bg-brand",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = "neutral", size = "sm", dot = false, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border rounded-md select-none whitespace-nowrap",
        VARIANTS[variant],
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", DOTS[variant])} />}
      {children}
    </span>
  );
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  active: "success",
  inactive: "neutral",
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
  STOCK_IN: "success",
  ADJUSTMENT_IN: "info",
  ADJUSTMENT_OUT: "warning",
  DELIVERY: "brand",
  DELIVERY_REVERSAL: "neutral",
  RETURN: "info",
  RETURN_REVERSAL: "neutral",
  PRODUCTION: "success",
  PRODUCTION_REVERSAL: "neutral",
};

/** Status pill used across all tables. */
export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return (
    <Badge variant={STATUS_VARIANTS[status] || "neutral"} dot>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
