"use client";

import { APP_NAME } from "@/lib/brand";
import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { useSession } from "@/components/providers/SessionProvider";
import { canBooking, canListBookings } from "@/lib/bookingAccess";
import { GlobalSearch } from "./GlobalSearch";
import { findActiveModule, isActivePath, type NavModule } from "./navigation";
import { UserMenu } from "./UserMenu";

/** Three tiers, as in Proserve ERP: brand bar (search + New Booking) → module tabs → active module's sub-tabs. */
export function TopHeader({ modules, onMenu }: { modules: NavModule[]; onMenu: () => void }) {
  const pathname = usePathname() || "";
  const user = useSession();
  const canWalkin = canBooking(user, "walkin", "create");
  const canAgent = canBooking(user, "agent", "create");
  const activeModule =
    findActiveModule(modules, pathname) ?? modules.find((m) => m.id === "home") ?? modules[0];

  return (
    <div className="no-print fixed top-0 left-0 md:left-[88px] right-0 z-40 select-none shadow-xs">
      <header className="relative h-[50px] bg-brand text-white px-3 sm:px-6 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={onMenu} aria-label="Open menu" className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold uppercase tracking-wider truncate max-w-[180px] sm:max-w-[280px]">{APP_NAME}</span>
        </span>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md lg:max-w-xl px-4 hidden md:block">
          {canListBookings(user) && <GlobalSearch />}
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          {canWalkin && (
            <Link
              href={`${BOOKING_BASE}/new`}
              title="New walk-in booking"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3.5 rounded-full bg-white text-brand text-xs font-bold hover:bg-brand-light shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Walk-in</span>
            </Link>
          )}
          {canAgent && (
            <Link
              href={`${BOOKING_BASE}/new-agent`}
              title="New agent booking"
              className="hidden lg:inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-white/40 text-white text-xs font-bold hover:bg-white/10"
            >
              <Plus className="w-4 h-4" />
              Agent Booking
            </Link>
          )}
          <UserMenu />
        </div>
      </header>

      {/* Module tabs (as in Proserve ERP) */}
      <div className="bg-white border-b border-line px-3 sm:px-6 flex items-center h-[40px]">
        <div className="flex items-center gap-5 sm:gap-8 overflow-x-auto no-scrollbar">
          {modules.map((mod) => {
            const active = mod.id === activeModule?.id;
            return (
              <Link
                key={mod.id}
                href={mod.items[0].href}
                className={`py-2.5 shrink-0 text-xs font-semibold uppercase tracking-wider relative ${active ? "text-brand font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                {mod.label}
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-brand" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Sub-tabs: pages of the active module */}
      <div className="bg-white border-b border-line px-3 sm:px-6 flex items-center h-[38px]">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {activeModule?.items.map((item) => {
            // Most specific match wins, so "/dashboard/stock" is not active on "/dashboard/stock/in"
            const best = activeModule.items
              .filter((i) => isActivePath(pathname, i.href))
              .sort((a, b) => b.href.length - a.href.length)[0];
            const active = best?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 shrink-0 text-sm border-b-2 ${active
                    ? "text-slate-900 font-semibold border-brand"
                    : "text-slate-500 hover:text-slate-900 border-transparent"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
