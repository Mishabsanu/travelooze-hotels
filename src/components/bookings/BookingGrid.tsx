"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Handshake, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useListParams } from "@/hooks/useListParams";
import { canBooking } from "@/lib/bookingAccess";
import { BOOKING_STATUS } from "@/lib/constants";
import { formatDay, formatINR } from "@/lib/format";
import type { Option } from "@/lib/types";
import type { Grid, GridCell, GridRoom } from "@/server/services/booking/grid";
import { BOOKING_BASE } from "./BookingListView";

const DAY = 86_400_000;
const RANGES = [7, 14, 30];

const BAR: Record<string, string> = {
  checked_in: "bg-emerald-500 text-white border-emerald-600",
  checked_out: "bg-slate-300 text-slate-700 border-slate-400",
  agent: "bg-amber-400 text-amber-950 border-amber-500",
  walkin: "bg-sky-500 text-white border-sky-600",
};
const barClass = (c: GridCell) => BAR[c.status] ?? BAR[c.source];

const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * DAY).toISOString().slice(0, 10);

interface Selection {
  room: GridRoom;
  type: string;
  start: number;
  end: number;
}

interface Props {
  grid: Grid;
  hotel: string;
  hotelOptions: Option[];
  typeOptions: Option[];
  roomType: string;
  days: number;
  today: string;
}

/**
 * Booking grid: rooms × dates. Booked nights show as bars (click → booking).
 * Click a free cell to start a stay, click another free cell in the same row to extend it, then book.
 */
export function BookingGrid({ grid, hotel, hotelOptions, typeOptions, roomType, days, today }: Props) {
  const user = useSession();
  const { update, isPending } = useListParams();
  const [sel, setSel] = useState<Selection | null>(null);
  const from = grid.days[0];
  const canWalkin = canBooking(user, "walkin", "create");
  const canAgent = canBooking(user, "agent", "create");

  const pick = (room: GridRoom, type: string, i: number) => {
    if (grid.days[i].slice(0, 10) < today || room.housekeeping === "maintenance") return;
    if (sel && sel.room._id === room._id && i > sel.start) {
      // Extend only across free nights
      const blocked = room.cells.slice(sel.start, i + 1).some(Boolean);
      if (!blocked) return setSel({ ...sel, end: i });
    }
    setSel({ room, type, start: i, end: i });
  };

  const bookingHref = (source: "walkin" | "agent") => {
    if (!sel) return "#";
    const q = new URLSearchParams({
      hotel,
      room: sel.room._id,
      checkIn: grid.days[sel.start].slice(0, 10),
      checkOut: addDays(grid.days[sel.end], 1),
    });
    return `${source === "agent" ? "/dashboard/sales/agent-bookings/new" : `${BOOKING_BASE}/new`}?${q}`;
  };

  const occupancy = useMemo(
    () => grid.freeByDay.map((free) => (grid.totalRooms ? Math.round(((grid.totalRooms - free) / grid.totalRooms) * 100) : 0)),
    [grid]
  );

  return (
    <div className="space-y-3">
      <div className="w-full bg-white border border-line text-slate-800">
        {/* Toolbar, same look as the DataTable filter bar */}
        <div className="flex flex-wrap items-stretch min-h-9 border-b border-line text-xs">
          <select value={hotel} onChange={(e) => update({ hotel: e.target.value, roomType: undefined })} aria-label="Hotel" className="h-9 border-r border-line px-3 bg-white outline-none cursor-pointer min-w-[190px]">
            {hotelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={roomType} onChange={(e) => update({ roomType: e.target.value })} aria-label="Room type" className="h-9 border-r border-line px-3 bg-white outline-none cursor-pointer min-w-[150px]">
            <option value="">All Room Types</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input type="date" value={from.slice(0, 10)} onChange={(e) => e.target.value && update({ from: e.target.value })} aria-label="From date" className="h-9 border-r border-line px-3 outline-none" />
          <div className="flex border-r border-line">
            {RANGES.map((r) => (
              <button key={r} type="button" onClick={() => update({ days: r === 14 ? undefined : r })} className={`h-9 px-3 font-semibold ${days === r ? "bg-brand text-white" : "hover:bg-head text-slate-600"}`}>
                {r}D
              </button>
            ))}
          </div>
          <button type="button" onClick={() => update({ from: addDays(from, -days) })} className="h-9 px-3 border-r border-line hover:bg-head" title="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => update({ from: undefined })} className="h-9 px-3 border-r border-line hover:bg-head font-bold text-brand">
            Today
          </button>
          <button type="button" onClick={() => update({ from: addDays(from, days) })} className="h-9 px-3 border-r border-line hover:bg-head" title="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex-1 flex flex-wrap items-center justify-end gap-3 px-3 py-1 text-[11px] text-slate-500">
            <Legend c="bg-sky-500" t="Walk-in" />
            <Legend c="bg-amber-400" t="Agent" />
            <Legend c="bg-emerald-500" t="Checked in" />
            <Legend c="bg-slate-300" t="Checked out" />
            <Legend c="bg-rose-100 border border-rose-200" t="Maintenance" />
          </div>
        </div>
        <p className="px-3 py-1.5 text-[11px] text-slate-500">
          Click a free cell to start a booking, click another free cell in the same row to extend the stay. Click a coloured bar to open that booking.
        </p>

        <div className={`overflow-x-auto border-t border-line transition-opacity ${isPending ? "opacity-50" : ""}`}>
          <table className="border-collapse text-xs table-fixed" style={{ minWidth: 150 + grid.days.length * (days > 14 ? 44 : 72) }}>
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="sticky left-0 z-20 bg-head px-3 py-2 border-r border-line text-left w-[150px]">Room</th>
                {grid.days.map((d) => {
                  const date = new Date(d);
                  const isToday = d.slice(0, 10) === today;
                  const weekend = [0, 6].includes(date.getUTCDay());
                  return (
                    <th key={d} className={`px-0.5 py-1.5 border-r border-line text-center ${isToday ? "bg-brand text-white" : weekend ? "bg-brand-light" : ""}`}>
                      <div className="text-[10px]">{date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</div>
                      <div className={`text-sm normal-case ${isToday ? "" : "text-slate-900"}`}>{date.getUTCDate()}</div>
                      {days <= 14 && <div className="text-[9.5px] normal-case tracking-normal font-medium">{date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div>}
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b border-line bg-white text-[10.5px]">
                <td className="sticky left-0 z-20 bg-white px-3 py-1 border-r border-line font-semibold text-slate-500">Free / Occ %</td>
                {grid.freeByDay.map((free, i) => (
                  <td key={i} className="border-r border-line text-center py-1">
                    <span className={`font-bold ${free === 0 ? "text-rose-600" : "text-emerald-700"}`}>{free}</span>
                    <span className="text-slate-400"> · {occupancy[i]}%</span>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.types.map((t) => (
                <Fragment key={t._id}>
                  <tr className="bg-head border-b border-line">
                    <td className="sticky left-0 z-10 bg-head px-3 py-1 text-[11px] font-bold text-brand uppercase tracking-wider">{t.name}</td>
                    <td colSpan={grid.days.length} className="px-2 py-1 text-[10.5px] text-slate-400">
                      {t.rooms.length} room(s)
                    </td>
                  </tr>
                  {t.rooms.map((r) => (
                    <RoomRow key={r._id} room={r} typeName={t.name} grid={grid} today={today} sel={sel?.room._id === r._id ? sel : null} onPick={pick} />
                  ))}
                </Fragment>
              ))}
              {grid.types.length === 0 && (
                <tr>
                  <td colSpan={grid.days.length + 1} className="px-6 py-12 text-center text-slate-400">
                    No rooms in this hotel yet. Add them under Property → Rooms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <div className="sticky bottom-3 z-30 mx-auto max-w-3xl bg-rail text-white rounded-xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3 animate-fade-in">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-bold">
              Room {sel.room.number} <span className="text-slate-400 font-medium">· {sel.type}</span>
            </p>
            <p className="text-[11px] text-slate-300">
              {formatDay(grid.days[sel.start])} → {formatDay(addDays(grid.days[sel.end], 1))} · {sel.end - sel.start + 1} night(s) · from{" "}
              {formatINR(sel.room.rates?.EP)} / night (EP)
            </p>
          </div>
          {canWalkin && (
            <Link href={bookingHref("walkin")} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark rounded-lg px-3.5 py-2 font-bold text-xs">
              <CalendarPlus className="w-4 h-4" /> Walk-in Booking
            </Link>
          )}
          {canAgent && (
            <Link href={bookingHref("agent")} className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-lg px-3.5 py-2 font-bold text-xs">
              <Handshake className="w-4 h-4" /> Agent Booking
            </Link>
          )}
          {!canWalkin && !canAgent && <span className="text-[11px] text-slate-400">Your role cannot create bookings</span>}
          <button type="button" onClick={() => setSel(null)} className="p-1.5 rounded-lg hover:bg-rail-active" title="Clear selection">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function RoomRow({
  room,
  typeName,
  grid,
  today,
  sel,
  onPick,
}: {
  room: GridRoom;
  typeName: string;
  grid: Grid;
  today: string;
  sel: Selection | null;
  onPick: (room: GridRoom, type: string, i: number) => void;
}) {
  // Merge consecutive nights of the same booking into one bar
  const segments: { start: number; span: number; cell: GridCell | null }[] = [];
  room.cells.forEach((c, i) => {
    const last = segments[segments.length - 1];
    if (c && last?.cell && last.cell._id === c._id) last.span++;
    else segments.push({ start: i, span: 1, cell: c });
  });
  const maintenance = room.housekeeping === "maintenance";

  return (
    <tr className="border-b border-line h-9">
      <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-line">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${maintenance ? "bg-rose-500" : room.housekeeping === "cleaning" ? "bg-amber-500" : "bg-emerald-500"}`} title={`Housekeeping: ${room.housekeeping}`} />
          <span className="font-mono font-bold text-slate-900">{room.number}</span>
          {room.floor && <span className="text-[10px] text-slate-400">F{room.floor}</span>}
        </span>
      </td>
      {segments.map(({ start, span, cell }) => {
        if (cell) {
          const title = `${cell.bookingNo} · ${cell.guest}\n${formatDay(cell.checkIn)} → ${formatDay(cell.checkOut)} · ${cell.mealPlan}\n${BOOKING_STATUS[cell.status]}${cell.agent ? ` · ${cell.agent}` : ""}${cell.balance > 0 ? `\nBalance ${formatINR(cell.balance)}` : ""}`;
          return (
            <td key={start} colSpan={span} className="p-0.5 border-r border-line">
              <Link href={`${BOOKING_BASE}/${cell._id}`} title={title} className={`flex items-center h-7 px-2 rounded border text-[11px] font-semibold truncate hover:brightness-95 ${barClass(cell)}`}>
                <span className="truncate">
                  {cell.guest}
                  {span > 1 && <span className="font-normal opacity-80"> · {cell.mealPlan}</span>}
                </span>
              </Link>
            </td>
          );
        }
        const day = grid.days[start].slice(0, 10);
        const past = day < today;
        const selected = sel && start >= sel.start && start <= sel.end;
        return (
          <td
            key={start}
            onClick={() => onPick(room, typeName, start)}
            title={past ? undefined : maintenance ? "Under maintenance" : `Book room ${room.number} from ${formatDay(day)}`}
            className={`border-r border-line text-center ${
              maintenance ? "bg-rose-50 cursor-not-allowed" : past ? "bg-slate-50" : selected ? "bg-brand/80 cursor-pointer" : "cursor-pointer hover:bg-brand-light group"
            }`}
          >
            {!past && !maintenance && !selected && <span className="text-brand opacity-0 group-hover:opacity-100 font-bold">+</span>}
            {selected && <span className="text-white font-bold text-[10px]">✓</span>}
          </td>
        );
      })}
    </tr>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm ${c}`} />
      {t}
    </span>
  );
}
