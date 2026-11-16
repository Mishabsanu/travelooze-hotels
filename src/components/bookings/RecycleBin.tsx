"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { BOOKING_STATUS, type BookingStatus } from "@/lib/constants";
import { formatDateTime, formatDay, formatINR } from "@/lib/format";
import type { BinBooking } from "@/server/services/booking/bookingActions";
import { ApiError, apiRequest } from "@/services/apiClient";
import { BOOKING_BASE } from "./bookingConfig";

const th = "px-3 py-2 text-left whitespace-nowrap";
const td = "px-3 py-2 align-middle";

/** Deleted bookings: restore (rooms held again) or, for Super Admin, delete forever. */
export function RecycleBin({ items, canPurge }: { items: BinBooking[]; canPurge: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [purge, setPurge] = useState<BinBooking | null>(null);

  const restore = async (b: BinBooking) => {
    setBusy(b._id);
    try {
      await apiRequest(`/api/bookings/${b._id}/restore`, "POST", {});
      toast.success(`Booking ${b.bookingNo} restored`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not restore");
    } finally {
      setBusy("");
    }
  };
  const purgeNow = async () => {
    if (!purge) return;
    setBusy(purge._id);
    try {
      await apiRequest(`/api/bookings/${purge._id}/restore`, "DELETE");
      toast.success(`Booking ${purge.bookingNo} deleted forever`);
      setPurge(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[860px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-line bg-head text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th className={th}>Booking</th>
            <th className={th}>Guest</th>
            <th className={th}>Hotel / Rooms</th>
            <th className={th}>Stay</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Total</th>
            <th className={th}>Deleted</th>
            <th className={`${th} text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((b) => (
            <tr key={b._id} className="hover:bg-head">
              <td className={`${td} font-mono font-bold text-slate-700`}>
                {b.bookingNo}
                {b.agentRef && <span className="block font-sans text-[10.5px] font-normal text-slate-400">Ref {b.agentRef}</span>}
              </td>
              <td className={td}>
                <span className="font-semibold text-slate-900">{b.guest}</span>
                <span className="block text-[10.5px] text-slate-400">{b.source === "agent" ? b.agent || "Agent" : "Walk-in"}</span>
              </td>
              <td className={td}>
                {b.hotel}
                <span className="block text-[10.5px] text-slate-400">Room {b.rooms.join(", ")}</span>
              </td>
              <td className={`${td} whitespace-nowrap`}>
                {formatDay(b.checkIn)} → {formatDay(b.checkOut)}
              </td>
              <td className={td}>
                <Badge variant="neutral">{BOOKING_STATUS[b.status as BookingStatus] ?? b.status}</Badge>
              </td>
              <td className={`${td} text-right tabular-nums`}>{formatINR(b.total)}</td>
              <td className={td}>
                <span className="font-semibold text-slate-800">{b.deletedBy || "—"}</span>
                <span className="block text-[10.5px] text-slate-400">{formatDateTime(b.deletedAt)}</span>
              </td>
              <td className={`${td} whitespace-nowrap text-center`}>
                <button
                  type="button"
                  disabled={busy === b._id}
                  onClick={() => restore(b)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-emerald-600 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
                {canPurge && (
                  <button
                    type="button"
                    disabled={busy === b._id}
                    onClick={() => setPurge(b)}
                    title="Delete forever"
                    className="ml-1.5 inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-rose-300 bg-white text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Forever
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                The Recycle Bin is empty. <Link href={BOOKING_BASE} className="font-semibold text-brand hover:underline">Back to Bookings</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ConfirmDeleteModal
        open={Boolean(purge)}
        entityLabel="Booking"
        itemName={purge ? `${purge.bookingNo} – ${purge.guest}` : ""}
        note="It is removed for good and cannot be restored."
        loading={Boolean(purge && busy === purge._id)}
        onCancel={() => setPurge(null)}
        onConfirm={purgeNow}
      />
    </div>
  );
}
