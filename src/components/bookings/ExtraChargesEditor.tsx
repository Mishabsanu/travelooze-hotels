"use client";

import { Plus, Trash2 } from "lucide-react";
import { CHARGE_CATEGORIES, type ChargeCategory } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { priceCharge } from "@/lib/pricing";

export interface ExtraCharge {
  key: number;
  category: ChargeCategory;
  description: string;
  amount: number | "";
  gstPercent: number;
}

const CATEGORY_OPTIONS = Object.entries(CHARGE_CATEGORIES).map(([value, c]) => ({ value: value as ChargeCategory, label: c.label }));
const field = "h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

export const newCharge = (): ExtraCharge => ({ key: Date.now() + Math.random(), category: "other", description: "", amount: "", gstPercent: CHARGE_CATEGORIES.other.gst });

/** Total (incl. GST) of the filled-in extra charges */
export const extrasTotal = (list: ExtraCharge[]) => list.reduce((t, c) => t + (Number(c.amount) > 0 ? priceCharge(1, Number(c.amount), c.gstPercent).total : 0), 0);

/**
 * Extra charges taken while booking (airport pick-up, extra food, decoration…).
 * They go on the booking's bill (folio) after it is saved, like the "Extra Charge" button on the booking page.
 */
export function ExtraChargesEditor({ value, onChange }: { value: ExtraCharge[]; onChange: (v: ExtraCharge[]) => void }) {
  const set = (key: number, patch: Partial<ExtraCharge>) => onChange(value.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-slate-700">Extra Charges</span>
        <button type="button" onClick={() => onChange([...value, newCharge()])} className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
          <Plus className="w-4 h-4" /> Add extra charge
        </button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-slate-400">Pick-up, extra food, decoration, … press “Add extra charge”.</p>
      ) : (
        <div className="space-y-2">
          {value.map((c) => {
            const amt = Number(c.amount) || 0;
            const total = amt > 0 ? priceCharge(1, amt, c.gstPercent).total : 0;
            return (
              <div key={c.key} className="grid grid-cols-2 sm:grid-cols-[180px_1fr_130px_90px_110px_36px] gap-2 items-center rounded-lg border border-line bg-slate-50/60 p-2">
                <select
                  aria-label="Charge type"
                  className={field}
                  value={c.category}
                  onChange={(e) => {
                    const category = e.target.value as ChargeCategory;
                    set(c.key, { category, gstPercent: CHARGE_CATEGORIES[category].gst });
                  }}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input aria-label="Description" placeholder="Description (optional)" maxLength={120} className={field} value={c.description} onChange={(e) => set(c.key, { description: e.target.value })} />
                <input
                  aria-label="Amount"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="Amount ₹"
                  className={field}
                  value={c.amount}
                  onChange={(e) => set(c.key, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input aria-label="GST %" type="number" min={0} max={28} step="1" className={`${field} w-14 px-2`} value={c.gstPercent} onChange={(e) => set(c.key, { gstPercent: Math.min(28, Math.max(0, Number(e.target.value) || 0)) })} />
                  % GST
                </label>
                <span className="text-sm font-semibold tabular-nums text-slate-800 sm:text-right">{formatINR(total)}</span>
                <button type="button" onClick={() => onChange(value.filter((x) => x.key !== c.key))} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Remove charge">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
