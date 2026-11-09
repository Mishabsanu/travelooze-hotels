import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function AccessDenied({ message, title = "Access denied" }: { message?: string; title?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
      <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-1">
        {message || "Your role does not have permission to open this page."}
      </p>
      <Link
        href="/dashboard"
        className="inline-flex mt-4 px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-lg"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
