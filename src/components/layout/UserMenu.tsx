"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { useSession } from "@/components/providers/SessionProvider";
import { apiRequest } from "@/services/apiClient";

export function UserMenu() {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", "POST");
    } catch {
      toast.error("Could not sign out cleanly");
    }
    // Hard navigation clears all client state
    window.location.href = "/login";
  };

  return (
    <div ref={ref} className="flex items-center gap-2 pl-3 border-l border-white/20 relative">
      <div className="hidden sm:flex flex-col items-end leading-tight mr-1 max-w-[160px]">
        <span className="text-xs font-semibold text-white truncate max-w-[160px]">{user.name}</span>
        <span className="text-[10px] text-white/70 truncate max-w-[160px]">{user.roleName}</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="w-8 h-8 rounded-full bg-sky-400 text-slate-900 font-bold flex items-center justify-center text-xs uppercase ring-2 ring-white/20"
      >
        {initials(user.name)}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-800 py-1.5 z-50 animate-fade-in">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold text-brand bg-brand-light px-2 py-0.5 rounded border border-brand-border">
              {user.roleName}
            </span>
          </div>
          <Link
            href={`/dashboard/admin/users/${user._id}/edit`}
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700 font-medium"
          >
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            My Account
          </Link>
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              onClick={logout}
              className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 text-xs font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      <button type="button" onClick={logout} title="Sign out" className="p-1 text-white/80 hover:text-white">
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
