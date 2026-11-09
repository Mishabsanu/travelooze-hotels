"use client";

import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { initials } from "@/lib/format";
import { useSession } from "@/components/providers/SessionProvider";
import { findActiveModule, isActivePath, type NavModule } from "./navigation";

export function LeftSidebar({ modules }: { modules: NavModule[] }) {
  const pathname = usePathname() || "";
  const user = useSession();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hovered = modules.find((m) => m.id === hoveredId);
  const activeId = findActiveModule(modules, pathname)?.id ?? (pathname === "/dashboard" ? "home" : undefined);

  const open = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFlyoutTop(e.currentTarget.getBoundingClientRect().top);
    setHoveredId(id);
  };

  const close = () => {
    timeoutRef.current = setTimeout(() => setHoveredId(null), 150);
  };

  return (
    <aside className="no-print hidden md:flex fixed left-0 top-0 bottom-0 w-[88px] bg-rail text-slate-300 flex-col z-50 select-none shadow-xl border-r border-rail-border">
      <div className="h-[50px] flex items-center justify-center px-2 border-b border-[#1e3a55]">
        <Link href="/dashboard" className="flex flex-col items-center justify-center w-full text-white" title={APP_NAME}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={APP_NAME} className="h-9 w-auto max-w-[76px] object-contain brightness-0 invert opacity-95 hover:opacity-100 transition-opacity" />
        </Link>
      </div>

      <nav className="flex-1 py-1 flex flex-col items-center overflow-y-auto no-scrollbar">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const active = mod.id === activeId;
          const highlighted = active || hoveredId === mod.id;
          return (
            <div key={mod.id} onMouseEnter={(e) => open(mod.id, e)} onMouseLeave={close} className="w-full">
              <Link
                href={mod.items[0].href}
                prefetch={false}
                className={`w-full py-3 flex flex-col items-center justify-center transition-colors ${
                  highlighted ? "bg-rail-active text-white" : "text-slate-400 hover:text-slate-100 hover:bg-rail-hover"
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] tracking-tight text-center font-medium leading-tight">{mod.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="p-2 border-t border-rail-border flex items-center justify-center bg-rail-header">
        <div
          title={user.name}
          className="w-7 h-7 rounded-full bg-rail-active border border-[#2b5175] text-white flex items-center justify-center text-[10px] font-bold uppercase"
        >
          {initials(user.name)}
        </div>
      </div>

      {hovered && (
        <div
          onMouseEnter={() => timeoutRef.current && clearTimeout(timeoutRef.current)}
          onMouseLeave={close}
          style={{ top: flyoutTop }}
          className="fixed left-[88px] w-52 bg-rail shadow-2xl py-1.5 z-50 text-white text-xs border border-l-0 border-[#1e3a55]"
        >
          {hovered.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setHoveredId(null)}
              className={`px-4 py-2 flex items-center text-xs transition-colors ${
                isActivePath(pathname, item.href)
                  ? "bg-rail-active text-white font-semibold"
                  : "text-slate-300 hover:bg-rail-hover hover:text-white"
              }`}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
