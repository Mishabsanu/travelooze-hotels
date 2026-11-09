import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const SIZES = {
  sm: "px-2.5 py-1 text-xs gap-1.5 h-8",
  md: "px-3.5 py-2 text-xs gap-2 h-9",
  lg: "px-5 py-2.5 text-sm gap-2.5 h-11",
};

const VARIANTS = {
  primary:
    "bg-brand text-white border border-brand-dark hover:bg-brand-dark focus:ring-brand shadow-xs active:scale-[0.98]",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-300 border border-slate-200",
  outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-xs active:scale-[0.98]",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  dark: "bg-rail text-white hover:bg-rail-active focus:ring-rail shadow-xs active:scale-[0.98]",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center font-bold transition-all duration-150 rounded-lg select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
        SIZES[size],
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
