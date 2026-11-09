import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + inline error, shared by every form input. */
export function FormField({ label, htmlFor, required, error, hint, className = "", children }: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-slate-700 select-none">
          {label}
          {required && <span className="text-rose-500 ml-0.5 font-bold">*</span>}
        </label>
        {hint && !error && <span className="text-[10.5px] text-slate-400 font-normal">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 animate-fade-in" role="alert">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Shared input styling so every control looks identical. */
export const inputClass = (hasError?: boolean) =>
  `w-full h-9 px-3 text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none font-medium text-slate-800 transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
    hasError ? "border-rose-400 ring-1 ring-rose-400/30" : "border-slate-300 focus:border-brand"
  }`;
