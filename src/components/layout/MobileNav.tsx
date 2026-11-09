"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { findActiveModule, isActivePath, type NavModule } from "./navigation";

/** Slide-out menu for phones / small tablets (the 88px rail is hidden below md). */
export function MobileNav({ modules, open, onClose }: { modules: NavModule[]; open: boolean; onClose: () => void }) {
  const pathname = usePathname() || "";
  const active = findActiveModule(modules, pathname);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="no-print md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-slate-900/50 animate-fade-in" />
      <nav className="absolute left-0 top-0 bottom-0 w-[82vw] max-w-[300px] bg-rail text-slate-200 shadow-2xl flex flex-col animate-fade-in">
        <div className="h-[56px] px-4 flex items-center justify-between border-b border-rail-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={APP_NAME} className="h-8 w-auto brightness-0 invert" />
          <button type="button" onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg hover:bg-rail-hover">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.id} className="px-2 py-1">
                <p className={`flex items-center gap-2 px-2 py-2 text-[11px] font-bold uppercase tracking-wider ${active?.id === m.id ? "text-white" : "text-slate-400"}`}>
                  <Icon className="w-4 h-4" />
                  {m.label}
                </p>
                {m.items.map((item) => {
                  const on =
                    m.items.filter((i) => isActivePath(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`block ml-6 px-3 py-2.5 rounded-lg text-sm ${on ? "bg-rail-active text-white font-semibold" : "text-slate-300 hover:bg-rail-hover"}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
