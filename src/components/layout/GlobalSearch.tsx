"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { formatDay } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";
import { apiRequest } from "@/services/apiClient";

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-sky-50 text-sky-700" },
  checked_in: { label: "In-house", cls: "bg-emerald-50 text-emerald-700" },
  checked_out: { label: "Checked out", cls: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700" },
  no_show: { label: "No-show", cls: "bg-rose-50 text-rose-700" },
};

/**
 * Header search: guest name, phone, booking no., agent ref or room number → jump straight to the booking.
 * Press "/" anywhere to focus it. Enter with nothing highlighted opens the full bookings list filtered by the text.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  // Results remember the text they belong to, so "loading" and stale results are derived, not stored
  const [results, setResults] = useState<{ term: string; items: Booking[] }>({ term: "", items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // "/" focuses the search (unless typing in another field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const term = q.trim();
  const loading = term.length >= 2 && results.term !== term;
  const items = results.term === term ? results.items : [];

  useEffect(() => {
    if (term.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      let found: Booking[] = [];
      try {
        found = (await apiRequest<{ items: Booking[] }>(`/api/bookings?${new URLSearchParams({ search: term, limit: "10", sort: "-checkIn" })}`)).items;
      } catch {}
      if (!stale) {
        setResults({ term, items: found });
        setActive(-1);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [term]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) go(`${BOOKING_BASE}/${items[active]._id}`);
      else if (items.length === 1) go(`${BOOKING_BASE}/${items[0]._id}`);
      else if (q.trim()) go(`${BOOKING_BASE}?${new URLSearchParams({ search: q.trim() })}`);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Find a booking: guest name, phone, booking no. or room   ( / )"
        aria-label="Search bookings"
        className="w-full pl-10 pr-9 py-1.5 bg-white text-sm text-slate-800 placeholder-slate-400 rounded-full border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
      />
      {loading && <Loader2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />}

      {open && term.length >= 2 && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No booking found for “{term}”.</p>
          ) : (
            <ul role="listbox" className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {items.map((b, i) => {
                const st = STATUS[b.status] ?? { label: b.status, cls: "bg-slate-100 text-slate-600" };
                return (
                  <li key={b._id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(`${BOOKING_BASE}/${b._id}`)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${i === active ? "bg-brand-light" : "hover:bg-slate-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {b.guest.name || "—"} <span className="font-normal text-slate-500">{b.guest.phone}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          <span className="font-mono">{b.bookingNo}</span> · {b.hotel?.name} · Room {b.rooms.map((r) => r.roomNumber).join(", ")} · {formatDay(b.checkIn)} → {formatDay(b.checkOut)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => go(`${BOOKING_BASE}?${new URLSearchParams({ search: term })}`)}
            className="w-full text-left px-4 py-2 text-xs font-bold text-brand bg-slate-50 hover:bg-slate-100 border-t border-slate-200"
          >
            See all results in Bookings →
          </button>
        </div>
      )}
    </div>
  );
}
