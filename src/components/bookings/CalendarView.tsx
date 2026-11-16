"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, CircleCheck, CircleDot, CircleX, LogIn, LogOut, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useListParams } from "@/hooks/useListParams";
import { canBooking } from "@/lib/bookingAccess";
import { BOOKING_STATUS } from "@/lib/constants";
import { formatDay, paxLabel } from "@/lib/format";
import type { Option } from "@/lib/types";
import type { CalendarDay, DayRoom } from "@/server/services/booking/calendar";
import { BOOKING_BASE } from "./bookingConfig";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Level = "free" | "partial" | "full" | "none";

/** Status of a night: colour + icon + word, never colour alone. */
const LEVEL: Record<Level, { label: string; cell: string; chip: string; icon: typeof CircleCheck }> = {
  free: { label: "Available", cell: "bg-emerald-50 border-emerald-200 hover:border-emerald-400", chip: "bg-emerald-100 text-emerald-800", icon: CircleCheck },
  partial: { label: "Partial", cell: "bg-amber-50 border-amber-200 hover:border-amber-400", chip: "bg-amber-100 text-amber-900", icon: CircleDot },
  full: { label: "Full", cell: "bg-rose-50 border-rose-200 hover:border-rose-400", chip: "bg-rose-100 text-rose-800", icon: CircleX },
  none: { label: "No rooms", cell: "bg-slate-50 border-slate-200", chip: "bg-slate-100 text-slate-500", icon: CircleDot },
};

export const levelOf = (d: CalendarDay): Level => (d.sellable === 0 ? "none" : d.sold === 0 ? "free" : d.sold >= d.sellable ? "full" : "partial");

const addDay = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

interface Props {
  hotel: string;
  hotelOptions: Option[];
  month: string; // YYYY-MM
  days: CalendarDay[];
  selected: string;
  rooms: DayRoom[];
  today: string;
}

export function CalendarView({ hotel, hotelOptions, month, days, selected, rooms, today }: Props) {
  const user = useSession();
  const { update, isPending } = useListParams();
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first blanks
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const monthTotals = days.reduce((a, d) => ({ sold: a.sold + d.sold, sellable: a.sellable + d.sellable }), { sold: 0, sellable: 0 });

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <div className="bg-white border border-line">
        <div className="flex flex-wrap items-stretch border-b border-line text-xs">
          <select value={hotel} onChange={(e) => update({ hotel: e.target.value })} aria-label="Hotel" className="h-9 border-b sm:border-b-0 border-r border-line px-3 bg-white outline-none cursor-pointer min-w-[170px] basis-full sm:basis-auto">
            {hotelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => update({ month: shiftMonth(-1), day: undefined })} className="h-9 px-3 border-r border-line hover:bg-head" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="h-9 px-3 border-r border-line flex items-center font-bold text-slate-800 min-w-[130px] justify-center">
            {MONTHS[m - 1]} {y}
          </span>
          <button type="button" onClick={() => update({ month: shiftMonth(1), day: undefined })} className="h-9 px-3 border-r border-line hover:bg-head" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => update({ month: undefined, day: undefined })} className="h-9 px-3 border-r border-line hover:bg-head font-bold text-brand">
            Today
          </button>
          <span className="flex items-center px-3 py-1 text-[11px] text-slate-500">
            Month occupancy {monthTotals.sellable ? Math.round((monthTotals.sold / monthTotals.sellable) * 100) : 0}%
          </span>
        </div>

        <div className="flex flex-wrap gap-3 px-3 py-2 text-[11px] text-slate-600 border-b border-line">
          {(["free", "partial", "full"] as const).map((l) => {
            const Icon = LEVEL[l].icon;
            return (
              <span key={l} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${LEVEL[l].chip}`}>
                <Icon className="w-3 h-3" /> {LEVEL[l].label}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1">
            <LogIn className="w-3 h-3" /> arrivals
          </span>
          <span className="inline-flex items-center gap-1">
            <LogOut className="w-3 h-3" /> departures
          </span>
        </div>

        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: lead }, (_, i) => (
              <div key={`b${i}`} />
            ))}
            {days.map((d) => {
              const level = levelOf(d);
              const L = LEVEL[level];
              const Icon = L.icon;
              const isSel = d.date === selected;
              const isToday = d.date === today;
              const past = d.date < today;
              const free = Math.max(0, d.sellable - d.sold);
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => update({ day: d.date, month })}
                  aria-pressed={isSel}
                  aria-label={`${formatDay(d.date)}: ${L.label}, ${d.sold} of ${d.sellable} rooms booked, ${d.arrivals} arrivals, ${d.departures} departures`}
                  className={`relative text-left rounded-lg border p-1 sm:p-2 min-h-[64px] sm:min-h-[92px] transition ${L.cell} ${isSel ? "ring-2 ring-brand ring-offset-1" : ""} ${past ? "opacity-60" : ""}`}
                >
                  <span className="flex items-center justify-between">
                    <span className={`text-xs sm:text-sm font-black ${isToday ? "w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center" : "text-slate-900"}`}>
                      {Number(d.date.slice(8))}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                  </span>
                  <span className={`mt-1 hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${L.chip}`}>
                    {level === "partial" ? `${free} free` : L.label}
                  </span>
                  <span className="block text-[10px] sm:text-[11px] text-slate-600 tabular-nums mt-0.5">
                    {d.sold}/{d.sellable}
                  </span>
                  {(d.arrivals > 0 || d.departures > 0) && (
                    <span className="hidden sm:flex gap-2 text-[10px] text-slate-500 mt-0.5">
                      {d.arrivals > 0 && (
                        <span className="inline-flex items-center gap-0.5" title="Arrivals">
                          <LogIn className="w-3 h-3" />
                          {d.arrivals}
                        </span>
                      )}
                      {d.departures > 0 && (
                        <span className="inline-flex items-center gap-0.5" title="Departures">
                          <LogOut className="w-3 h-3" />
                          {d.departures}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DayPanel hotel={hotel} day={selected} rooms={rooms} today={today} canBook={canBooking(user, "walkin", "create")} canAgent={canBooking(user, "agent", "create")} summary={days.find((d) => d.date === selected)} />
    </div>
  );
}

type Filter = "all" | "booked" | "free";

function DayPanel({ hotel, day, rooms, today, canBook, canAgent, summary }: { hotel: string; day: string; rooms: DayRoom[]; today: string; canBook: boolean; canAgent: boolean; summary?: CalendarDay }) {
  const [filter, setFilter] = useState<Filter>("all");
  const booked = rooms.filter((r) => r.state === "booked").length;
  const free = rooms.filter((r) => r.state === "free").length;
  const level = summary ? levelOf(summary) : "none";
  const L = LEVEL[level];
  const Icon = L.icon;
  const shown = rooms.filter((r) => filter === "all" || (filter === "booked" ? r.state === "booked" : r.state === "free"));
  const bookable = day >= today;
  const newHref = (roomId: string, agent: boolean) =>
    `${agent ? "/dashboard/sales/agent-bookings/new" : `${BOOKING_BASE}/new`}?${new URLSearchParams({ hotel, room: roomId, checkIn: day, checkOut: addDay(day, 1) })}`;

  return (
    <div className="bg-white border border-line self-start xl:sticky xl:top-[140px]">
      <div className="px-3 py-2.5 border-b border-line">
        <p className="text-sm font-bold text-slate-900">{formatDay(day)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${L.chip}`}>
            <Icon className="w-3 h-3" /> {L.label}
          </span>
          <span className="text-slate-600">
            {booked} booked · {free} free{summary ? ` · ${summary.arrivals} arriving · ${summary.departures} leaving` : ""}
          </span>
        </p>
      </div>
      <div className="flex border-b border-line text-xs" role="group" aria-label="Show rooms">
        {(["all", "booked", "free"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`flex-1 h-8 font-semibold capitalize ${filter === f ? "bg-brand text-white" : "text-slate-600 hover:bg-head"}`}>
            {f} ({f === "all" ? rooms.length : f === "booked" ? booked : free})
          </button>
        ))}
      </div>
      <ul className="divide-y divide-line max-h-[640px] overflow-y-auto">
        {shown.map((r) => (
          <li key={r._id} className="px-3 py-2 flex items-start gap-3">
            <span className="w-12 shrink-0">
              <span className="block font-mono font-black text-slate-900">{r.number}</span>
              <span className="block text-[10px] text-slate-400 truncate">{r.type}</span>
            </span>
            <span className="flex-1 min-w-0 text-xs">
              {r.state === "booked" && r.booking ? (
                <>
                  <Link href={`${BOOKING_BASE}/${r.booking._id}`} className="font-semibold text-brand hover:underline truncate block">
                    {r.booking.guest}
                  </Link>
                  <span className="block text-[10.5px] text-slate-500">
                    {r.booking.bookingNo} · {BOOKING_STATUS[r.booking.status]} · {r.booking.source === "agent" ? "Agent" : "Walk-in"} · {paxLabel(r.booking.adults, r.booking.children)}
                  </span>
                  <span className="block text-[10.5px] text-slate-400">
                    {formatDay(r.booking.checkIn)} → {formatDay(r.booking.checkOut)}
                  </span>
                </>
              ) : r.state === "maintenance" ? (
                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                  <Wrench className="w-3 h-3" /> Under maintenance
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold">Free</span>
              )}
              {r.arriving && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-sky-700">
                  <LogIn className="w-3 h-3" /> Arrives
                </span>
              )}
              {r.departing && (
                <span className="mt-0.5 ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700" title={`${r.departing.bookingNo} · ${r.departing.guest}`}>
                  <LogOut className="w-3 h-3" /> {r.departing.guest} leaves
                </span>
              )}
            </span>
            <span className="shrink-0">
              {r.state === "booked" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                  <CircleX className="w-3 h-3" /> Booked
                </span>
              ) : r.state === "free" && bookable && (canBook || canAgent) ? (
                <Link
                  href={newHref(r._id, !canBook)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-brand text-white hover:bg-brand-dark"
                >
                  <CalendarPlus className="w-3 h-3" /> Book
                </Link>
              ) : r.state === "free" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  <CircleCheck className="w-3 h-3" /> Free
                </span>
              ) : null}
            </span>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-8 text-center text-xs text-slate-400">No rooms in this list</li>}
      </ul>
    </div>
  );
}
