"use client";

import { CalendarPlus, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { usePermission, useSession } from "@/components/providers/SessionProvider";
import { useListParams } from "@/hooks/useListParams";
import { canBooking } from "@/lib/bookingAccess";
import { ROOM_STATUS, type RoomStatus } from "@/lib/constants";
import { formatDay, formatINR } from "@/lib/format";
import type { Option } from "@/lib/types";
import type { BoardRoom, RoomState } from "@/server/services/booking/grid";
import { apiRequest, ApiError } from "@/services/apiClient";
import { BOOKING_BASE } from "./BookingListView";

const STATE: Record<RoomState, { label: string; card: string; chip: string }> = {
  vacant: { label: "Vacant", card: "border-emerald-200", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  occupied: { label: "Occupied", card: "border-sky-300 bg-sky-50/40", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  arriving: { label: "Arriving", card: "border-brand-border bg-brand-light/40", chip: "bg-brand-light text-brand border-brand-border" },
  due_out: { label: "Due Out", card: "border-amber-300 bg-amber-50/40", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  reserved: { label: "Reserved (not arrived)", card: "border-rose-200", chip: "bg-rose-50 text-rose-700 border-rose-200" },
};

const HK_DOT: Record<RoomStatus, string> = { available: "bg-emerald-500", cleaning: "bg-amber-500", maintenance: "bg-rose-500" };

export function RoomBoard({ rooms, hotel, hotelOptions, today }: { rooms: BoardRoom[]; hotel: string; hotelOptions: Option[]; today: string }) {
  const user = useSession();
  const router = useRouter();
  const { update, isPending } = useListParams();
  const canHousekeep = usePermission("room", "update");
  const canBook = canBooking(user, "walkin", "create");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<RoomState | "dirty" | "">("");

  const counts = rooms.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    if (r.housekeeping !== "available") acc.dirty = (acc.dirty ?? 0) + 1;
    return acc;
  }, {});
  const shown = rooms.filter((r) => !filter || (filter === "dirty" ? r.housekeeping !== "available" : r.state === filter));

  const setHk = async (room: BoardRoom, housekeeping: RoomStatus) => {
    setBusy(room._id);
    try {
      await apiRequest(`/api/rooms/${room._id}`, "PATCH", { housekeeping });
      toast.success(`Room ${room.number}: ${ROOM_STATUS[housekeeping]}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update");
    } finally {
      setBusy("");
    }
  };

  const tomorrow = new Date(new Date(`${today}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  const chips: { key: RoomState | "dirty" | ""; label: string }[] = [
    { key: "", label: `All ${rooms.length}` },
    { key: "vacant", label: `Vacant ${counts.vacant ?? 0}` },
    { key: "occupied", label: `Occupied ${counts.occupied ?? 0}` },
    { key: "arriving", label: `Arriving ${counts.arriving ?? 0}` },
    { key: "due_out", label: `Due Out ${counts.due_out ?? 0}` },
    { key: "reserved", label: `Not Arrived ${counts.reserved ?? 0}` },
    { key: "dirty", label: `Cleaning / Maint. ${counts.dirty ?? 0}` },
  ];

  return (
    <div className="space-y-3">
      <div className="w-full bg-white border border-line flex flex-wrap items-stretch text-xs">
        <select value={hotel} onChange={(e) => update({ hotel: e.target.value })} aria-label="Hotel" className="h-9 border-r border-line px-3 bg-white outline-none cursor-pointer min-w-[190px]">
          {hotelOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {chips.map((c) => (
          <button
            key={c.key || "all"}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`h-9 px-3 border-r border-line font-semibold ${filter === c.key ? "bg-brand text-white" : "text-slate-600 hover:bg-head"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {shown.map((r) => {
          const s = STATE[r.state];
          return (
            <div key={r._id} className={`bg-white border rounded-lg p-2.5 flex flex-col gap-1.5 shadow-xs ${s.card}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-black text-slate-900">{r.number}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${HK_DOT[r.housekeeping]}`} title={ROOM_STATUS[r.housekeeping]} />
              </div>
              <span className="text-[10.5px] text-slate-500 truncate">
                {r.type}
                {r.floor ? ` · Floor ${r.floor}` : ""}
              </span>
              <span className={`self-start text-[9.5px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${s.chip}`}>{s.label}</span>

              {r.booking ? (
                <Link href={`${BOOKING_BASE}/${r.booking._id}`} className="text-[11px] leading-tight hover:underline">
                  <span className="block font-semibold text-slate-800 truncate">{r.booking.guest}</span>
                  <span className="block text-slate-400">
                    out {formatDay(r.booking.checkOut)}
                    {r.booking.balance > 0 && <span className="text-rose-600"> · due {formatINR(r.booking.balance)}</span>}
                  </span>
                </Link>
              ) : canBook && r.housekeeping !== "maintenance" ? (
                <Link
                  href={`${BOOKING_BASE}/new?${new URLSearchParams({ hotel, room: r._id, checkIn: today, checkOut: tomorrow })}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                >
                  <CalendarPlus className="w-3 h-3" /> Book tonight
                </Link>
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )}

              {canHousekeep && (
                <div className="flex gap-1 pt-1 border-t border-slate-100 mt-auto">
                  {r.housekeeping !== "available" && (
                    <button type="button" disabled={busy === r._id} onClick={() => setHk(r, "available")} className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 rounded py-1" title="Mark clean">
                      <Sparkles className="w-3 h-3" /> Clean
                    </button>
                  )}
                  {r.housekeeping === "available" && (
                    <button type="button" disabled={busy === r._id} onClick={() => setHk(r, "cleaning")} className="flex-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50 rounded py-1">
                      Needs cleaning
                    </button>
                  )}
                  {r.housekeeping !== "maintenance" && r.state === "vacant" && (
                    <button type="button" disabled={busy === r._id} onClick={() => setHk(r, "maintenance")} className="px-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Under maintenance">
                      <Wrench className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="col-span-full text-center text-xs text-slate-400 py-10">No rooms match this filter</p>}
      </div>
    </div>
  );
}
