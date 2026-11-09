import Link from "next/link";
import { SearchX } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
      <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-3">
        <SearchX className="w-6 h-6" />
      </div>
      <h2 className="text-sm font-bold text-slate-900">Record not found</h2>
      <p className="text-xs text-slate-500 mt-1">It may have been deleted, or the link is incorrect.</p>
      <Link href="/dashboard" className="inline-flex mt-4 px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-lg">
        Back to dashboard
      </Link>
    </div>
  );
}
