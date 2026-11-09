"use client";

import { Receipt, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/providers/SessionProvider";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CHARGE_CATEGORIES } from "@/lib/constants";
import { formatDay, formatINR } from "@/lib/format";
import type { Booking, BookingCharge } from "@/lib/hotelTypes";
import { ApiError, apiRequest } from "@/services/apiClient";

const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0";

/** Extra charges (folio) on a booking. Removing a charge needs the payment "delete" permission. */
export function FolioList({ booking: b }: { booking: Booking }) {
  const router = useRouter();
  const canRemove = usePermission("payment", "delete") && (b.status === "confirmed" || b.status === "checked_in");
  const [target, setTarget] = useState<BookingCharge | null>(null);
  const [busy, setBusy] = useState(false);
  if (!b.charges.length) return null;

  const remove = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await apiRequest(`/api/bookings/${b._id}/charges/${target._id}`, "DELETE");
      toast.success("Charge removed");
      setTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-1.5">
        <Receipt className="w-3.5 h-3.5" /> Extra Charges
      </h2>
      <div className="border border-line overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${th} text-left`}>Date</th>
              <th className={`${th} text-left`}>Item</th>
              <th className={`${th} text-right`}>Qty × Rate</th>
              <th className={`${th} text-right`}>GST</th>
              <th className={`${th} text-right`}>Total</th>
              {canRemove && <th className={`${th} w-10 no-print`} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {b.charges.map((c) => (
              <tr key={c._id} className="hover:bg-head">
                <td className={td}>{formatDay(c.date)}</td>
                <td className={td}>
                  <span className="font-semibold text-slate-800">{c.description}</span>
                  <span className="block text-[10.5px] text-slate-400">
                    {CHARGE_CATEGORIES[c.category]?.label} · by {c.by?.name ?? "—"}
                  </span>
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {c.qty} × {formatINR(c.rate)}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {c.gstPercent}% · {formatINR(c.gstAmount)}
                </td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{formatINR(c.total)}</td>
                {canRemove && (
                  <td className={`${td} text-center no-print`}>
                    <button type="button" title="Remove charge" onClick={() => setTarget(c)} className="p-1 text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDeleteModal open={Boolean(target)} entityLabel="Charge" itemName={target?.description} loading={busy} onCancel={() => setTarget(null)} onConfirm={remove} />
    </section>
  );
}
