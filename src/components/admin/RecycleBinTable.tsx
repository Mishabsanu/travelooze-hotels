"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { formatDateTime } from "@/lib/format";
import { ApiError, apiRequest } from "@/services/apiClient";

export interface BinRow {
  _id: string;
  title: string;
  subtitle: string;
  deletedAt: string;
  deletedBy: string;
}

const th = "px-3 py-2 text-left whitespace-nowrap";
const td = "px-3 py-2 align-middle";

/** Deleted items of one module: Restore, or Delete Forever (Super Admin). */
export function RecycleBinTable({ module, label, items, canPurge }: { module: string; label: string; items: BinRow[]; canPurge: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [purge, setPurge] = useState<BinRow | null>(null);

  const act = async (row: BinRow, method: "POST" | "DELETE") => {
    setBusy(row._id);
    try {
      await apiRequest(`/api/recycle-bin/${module}/${row._id}`, method, method === "POST" ? {} : undefined);
      toast.success(method === "POST" ? `${row.title} restored` : `${row.title} deleted forever`);
      setPurge(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-line bg-head text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th className={th}>{label.replace(/s$/, "")}</th>
            <th className={th}>Deleted By</th>
            <th className={th}>Deleted On</th>
            <th className={`${th} text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((r) => (
            <tr key={r._id} className="hover:bg-head">
              <td className={td}>
                <span className="font-semibold text-slate-900">{r.title}</span>
                {r.subtitle && <span className="block text-[10.5px] text-slate-400">{r.subtitle}</span>}
              </td>
              <td className={td}>{r.deletedBy || "—"}</td>
              <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.deletedAt)}</td>
              <td className={`${td} whitespace-nowrap text-center`}>
                <button
                  type="button"
                  disabled={busy === r._id}
                  onClick={() => act(r, "POST")}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-emerald-600 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
                {canPurge && (
                  <button
                    type="button"
                    disabled={busy === r._id}
                    onClick={() => setPurge(r)}
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
              <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                No deleted {label.toLowerCase()}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ConfirmDeleteModal
        open={Boolean(purge)}
        entityLabel={label.replace(/s$/, "")}
        itemName={purge?.title}
        note="It is removed for good and cannot be restored."
        loading={Boolean(purge && busy === purge._id)}
        onCancel={() => setPurge(null)}
        onConfirm={() => purge && act(purge, "DELETE")}
      />
    </div>
  );
}
