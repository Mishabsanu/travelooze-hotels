"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Handshake, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import { useListParams } from "@/hooks/useListParams";
import { canBooking } from "@/lib/bookingAccess";
import { BOOKING_STATUS } from "@/lib/constants";
import { formatDay, formatINR } from "@/lib/format";
import { timeLabel } from "@/lib/stayTimes";
import type { Option } from "@/lib/types";
import type { Grid, GridCell, GridRoom } from "@/server/services/booking/grid";
import { BOOKING_BASE } from "./bookingConfig";

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

/** One picked room and its nights (start..end, day indexes). Each room has its own dates. */
interface Pick {
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
 * Click a free cell to start a stay, a later cell in the same row to add nights, a cell in another row to add that room, then book.
 */
export function BookingGrid({ grid, hotel, hotelOptions, typeOptions, roomType, days, today }: Props) {
  const user = useSession();
  const { update, isPending } = useListParams();
  const [picks, setPicks] = useState<Pick[]>([]);
  const from = grid.days[0];
  const canWalkin = canBooking(user, "walkin", "create");
  const canAgent = canBooking(user, "agent", "create");

  // Is this room free on every night from a to b?
  const freeFor = (room: GridRoom, a: number, b: number) => !room.cells.slice(a, b + 1).some(Boolean);

  const pick = (room: GridRoom, type: string, i: number) => {
    if (grid.days[i].slice(0, 10) < today || room.housekeeping === "maintenance") return;
    const mine = picks.find((x) => x.room._id === room._id);
    const others = picks.filter((x) => x.room._id !== room._id);
    // New row: this room from this night (same nights as the last room when it starts the same day and is free)
    if (!mine) {
      const ref = picks[picks.length - 1];
      const same = Boolean(ref) && i === ref.start && freeFor(room, ref.start, ref.end);
      return setPicks([...picks, { room, type, start: i, end: same ? ref.end : i }]);
    }
    if (i > mine.end) {
      // Later night in the same row: extend this room only
      if (freeFor(room, mine.start, i)) return setPicks([...others, { ...mine, end: i }].sort(byPick));
      toast.warning(`Room ${room.number} is booked in between`);
      return;
    }
    if (i < mine.start) return setPicks([...others, { ...mine, start: i, end: i }].sort(byPick));
    // Tapped inside: the last night shortens the stay, any other night removes the room
    if (i === mine.end && mine.end > mine.start) return setPicks([...others, { ...mine, end: i - 1 }].sort(byPick));
    setPicks(others);
  };

  const removeRoom = (id: string) => setPicks((ps) => ps.filter((x) => x.room._id !== id));
  const dayOf = (i: number) => grid.days[i].slice(0, 10);
  const ranges = new Set(picks.map((x) => `${x.start}-${x.end}`));
  const split = ranges.size > 1;

  const bookingHref = (source: "walkin" | "agent") => {
    if (!picks.length) return "#";
    const q = new URLSearchParams({ hotel });
    if (split) {
      // Different dates per room: the form saves one booking per date range
      q.set("stays", picks.map((x) => `${x.room._id}:${dayOf(x.start)}:${addDays(grid.days[x.end], 1)}`).join(","));
    } else {
      q.set("rooms", picks.map((x) => x.room._id).join(","));
      q.set("checkIn", dayOf(picks[0].start));
      q.set("checkOut", addDays(grid.days[picks[0].end], 1));
    }
    return `${source === "agent" ? "/dashboard/front-office/bookings/new-agent" : `${BOOKING_BASE}/new`}?${q}`;
  };

  const occupancy = useMemo(
    () => grid.freeByDay.map((free) => (grid.totalRooms ? Math.round(((grid.totalRooms - free) / grid.totalRooms) * 100) : 0)),
    [grid]
  );

  return (
    <div className={`space-y-3 ${picks.length ? "pb-48 sm:pb-32" : ""}`}>
      <div className="w-full bg-white border border-line text-slate-800">
        {/* Toolbar, same look as the DataTable filter bar */}
        <div className="flex flex-wrap items-stretch min-h-9 border-b border-line text-xs">
          <select value={hotel} onChange={(e) => update({ hotel: e.target.value, roomType: undefined })} aria-label="Hotel" className="h-10 sm:h-9 w-full sm:w-auto border-b sm:border-b-0 sm:border-r border-line px-3 bg-white outline-none cursor-pointer sm:min-w-[190px]">
            {hotelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={roomType} onChange={(e) => update({ roomType: e.target.value })} aria-label="Room type" className="h-10 sm:h-9 flex-1 sm:flex-none border-r border-line px-3 bg-white outline-none cursor-pointer sm:min-w-[150px]">
            <option value="">All Room Types</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input type="date" value={from.slice(0, 10)} onChange={(e) => e.target.value && update({ from: e.target.value })} aria-label="From date" className="h-10 sm:h-9 flex-1 sm:flex-none border-r border-line px-3 outline-none" />
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
          <div className="w-full lg:w-auto lg:flex-1 flex flex-wrap items-center lg:justify-end gap-3 px-3 py-1.5 text-[11px] text-slate-500 border-t lg:border-t-0 border-line">
            <Legend c="bg-sky-500" t="Walk-in" />
            <Legend c="bg-amber-400" t="Agent" />
            <Legend c="bg-emerald-500" t="Checked in" />
            <Legend c="bg-slate-300" t="Checked out" />
            <Legend c="bg-rose-100 border border-rose-200" t="Maintenance" />
          </div>
        </div>
        <p className="px-3 py-1.5 text-[11px] text-slate-500">
          <b className="text-slate-700">To book:</b> tap a free cell (first night) → tap a later cell in the same row for more nights → tap <b className="text-slate-700">other rows to add more rooms</b>, each with its own dates → press <b className="text-slate-700">Book</b>. Tap a room&apos;s last night to shorten it, any other selected night to remove the room.
        </p>

        <div className={`overflow-x-auto border-t border-line transition-opacity ${isPending ? "opacity-50" : ""}`}>
          <table className="border-collapse text-xs table-fixed" style={{ minWidth: 84 + grid.days.length * (days > 14 ? 44 : 64) }}>
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="sticky left-0 z-20 bg-head px-2 sm:px-3 py-2 border-r border-line text-left w-[84px] sm:w-[150px]">Room</th>
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
                <td className="sticky left-0 z-20 bg-white px-2 sm:px-3 py-1 border-r border-line font-semibold text-slate-500">Free</td>
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
                    <RoomRow key={r._id} room={r} typeName={t.name} grid={grid} today={today} sel={picks.find((x) => x.room._id === r._id) ?? null} onPick={pick} />
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

      {picks.length > 0 && (
        // Fixed to the screen (not sticky): the page's scroll container would otherwise push it below the grid, out of sight
        <div className="fixed inset-x-3 bottom-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[min(620px,calc(100vw-48px))] md:w-[min(620px,calc(100vw-136px))] z-40 pointer-events-none">
          <div className="pointer-events-auto w-full bg-rail ring-1 ring-white/10 text-white rounded-xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3 animate-fade-in">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-bold">
                {picks.length} room{picks.length > 1 ? "s" : ""}
                {split ? (
                  <span className="ml-2 rounded bg-amber-400/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-200">
                    Different dates · saves {ranges.size} bookings
                  </span>
                ) : (
                  <span className="font-medium text-slate-300">
                    {" "}
                    · {formatDay(grid.days[picks[0].start])} → {formatDay(addDays(grid.days[picks[0].end], 1))} · {picks[0].end - picks[0].start + 1} night
                    {picks[0].end > picks[0].start ? "s" : ""}
                  </span>
                )}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {picks.map(({ room, type, start, end }) => (
                  <span key={room._id} className="inline-flex items-center gap-1 rounded-md bg-white/10 pl-2 pr-1 py-0.5 text-xs">
                    <b className="font-mono">{room.number}</b>
                    <span className="text-slate-300">{type}</span>
                    {split && (
                      <span className="text-amber-200">
                        {formatDay(grid.days[start])} · {end - start + 1}N
                      </span>
                    )}
                    <button type="button" onClick={() => removeRoom(room._id)} className="p-0.5 rounded hover:bg-white/20" aria-label={`Remove room ${room.number}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-300">
                From {formatINR(picks.reduce((sum, x) => sum + (x.room.rates?.EP ?? 0) * (x.end - x.start + 1), 0))} (EP, before GST) ·{" "}
                <span className="text-slate-400">tap other rows to add rooms</span>
              </p>
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              {canWalkin && (
                <Link href={bookingHref("walkin")} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark rounded-lg px-4 h-10 font-bold text-sm">
                  <CalendarPlus className="w-4 h-4" /> Book Walk-in
                </Link>
              )}
              {canAgent && (
                <Link href={bookingHref("agent")} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-lg px-4 h-10 font-bold text-sm">
                  <Handshake className="w-4 h-4" /> Book Agent
                </Link>
              )}
              {!canWalkin && !canAgent && <span className="text-[11px] text-slate-400">Your role cannot create bookings</span>}
              <button type="button" onClick={() => setPicks([])} className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-lg hover:bg-rail-active" title="Clear selection" aria-label="Clear selection">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
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
  sel: Pick | null;
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
    <tr className="border-b border-line h-10 sm:h-9">
      <td className="sticky left-0 z-10 bg-white px-2 sm:px-3 py-1 border-r border-line">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${maintenance ? "bg-rose-500" : room.housekeeping === "cleaning" ? "bg-amber-500" : "bg-emerald-500"}`} title={`Housekeeping: ${room.housekeeping}`} />
          <span className="font-mono font-bold text-slate-900">{room.number}</span>
          {room.floor && <span className="text-[10px] text-slate-400">F{room.floor}</span>}
        </span>
      </td>
      {segments.map(({ start, span, cell }) => {
        if (cell) {
          const title = `${cell.bookingNo} · ${cell.guest}\n${formatDay(cell.checkIn)} ${timeLabel(cell.arrivalTime)} → ${formatDay(cell.checkOut)} ${timeLabel(cell.departureTime)} · ${cell.mealPlan}\n${BOOKING_STATUS[cell.status]}${cell.agent ? ` · ${cell.agent}` : ""}${cell.balance > 0 ? `\nBalance ${formatINR(cell.balance)}` : ""}`;
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

const byPick = (a: Pick, b: Pick) => a.start - b.start || a.end - b.end;

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm ${c}`} />
      {t}
    </span>
  );
}
