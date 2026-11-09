"use client";

import { Building2, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import type { Option } from "@/lib/types";
import { apiRequest, ApiError } from "@/services/apiClient";

/**
 * Header hotel switcher. Choosing a hotel narrows EVERY screen (bookings, grid, room status, overview,
 * revenue, reports, agent balances, dropdowns) to that hotel; "All my hotels" shows every assigned hotel.
 * The server re-checks the choice against the user's assigned hotels on every request.
 */
export function HotelSwitcher({ hotels }: { hotels: Option[] }) {
  const user = useSession();
  const pathname = usePathname() || "";
  const [busy, setBusy] = useState(false);
  const current = hotels.find((h) => h.value === user.activeHotelId);

  // One hotel only: just show its name
  if (hotels.length <= 1) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-bold text-white max-w-full">
        <Building2 className="w-4 h-4 shrink-0" />
        <span className="truncate">{hotels[0]?.label ?? "No hotel assigned"}</span>
      </div>
    );
  }

  const choose = async (hotel: string) => {
    setBusy(true);
    try {
      await apiRequest("/api/auth/hotel", "POST", { hotel });
      // A record of another hotel would no longer be visible: go back to the overview in that case
      window.location.href = /\/[a-f0-9]{24}(\/|$)/.test(pathname) ? "/dashboard/overview" : window.location.pathname;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not switch hotel");
      setBusy(false);
    }
  };

  return (
    <label
      className={`relative inline-flex items-center gap-2 pl-4 pr-9 py-1.5 rounded-full bg-white text-slate-800 shadow-xs max-w-full cursor-pointer ${busy ? "opacity-60" : ""}`}
      title="Choose the hotel you are working on"
    >
      <Building2 className="w-4 h-4 text-brand shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Hotel</span>
      <span className="text-xs font-bold truncate">{current?.label ?? `All my hotels (${hotels.length})`}</span>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3" />
      <select
        value={user.activeHotelId ?? ""}
        disabled={busy}
        onChange={(e) => choose(e.target.value)}
        aria-label="Hotel"
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="">All my hotels ({hotels.length})</option>
        {hotels.map((h) => (
          <option key={h.value} value={h.value}>
            {h.label}
          </option>
        ))}
      </select>
    </label>
  );
}
