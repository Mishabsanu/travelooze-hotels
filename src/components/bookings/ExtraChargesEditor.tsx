"use client";

import { Plus, X } from "lucide-react";
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
const field = "h-9 w-full px-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";
const cols = "sm:grid-cols-[200px_minmax(0,1fr)_150px_36px]";

export const newCharge = (): ExtraCharge => ({ key: Date.now() + Math.random(), category: "other", description: "", amount: "", gstPercent: 0 });

/** Total of the filled-in extra charges (no GST) */
export const extrasTotal = (list: ExtraCharge[]) => list.reduce((t, c) => t + (Number(c.amount) > 0 ? priceCharge(1, Number(c.amount), c.gstPercent).total : 0), 0);

/**
 * Extra charges taken while booking (pick-up, extra food, decoration…): one clean table.
 * They go on the booking's bill (folio) after it is saved, like the "Extra Charge" button on the booking page.
 */
export function ExtraChargesEditor({ value, onChange, compact = false }: { value: ExtraCharge[]; onChange: (v: ExtraCharge[]) => void; compact?: boolean }) {
  const set = (key: number, patch: Partial<ExtraCharge>) => onChange(value.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const total = extrasTotal(value);

  return (
    <div className="col-span-full rounded-lg border border-line bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-head border-b border-line">
        <span className="text-xs font-bold text-slate-700">Extra charges</span>
        <span className="text-xs text-slate-500">No GST on extras</span>
      </div>

      {/* Column names, once */}
      <div className={`${compact ? "hidden" : "hidden sm:grid"} ${cols} gap-2 px-3 pt-2 text-[11px] font-semibold text-slate-500`}>
        <span>Type</span>
        <span>Description</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className={compact ? "divide-y divide-line" : "divide-y divide-line sm:divide-y-0"}>
        {value.map((c, i) => (
          <div key={c.key} className={compact ? "grid grid-cols-[minmax(0,1fr)_112px_32px] gap-2 px-3 py-2 items-center" : `grid grid-cols-[1fr_36px] ${cols} gap-2 px-3 py-2 items-center`}>
            <select aria-label="Charge type" className={`${field} col-span-1`} value={c.category} onChange={(e) => set(c.key, { category: e.target.value as ChargeCategory })}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Description"
              placeholder="e.g. Airport pick-up"
              maxLength={120}
              autoFocus={i === value.length - 1 && !c.description && c.amount === ""}
              className={compact ? `${field} col-span-3 order-4` : `${field} col-span-2 sm:col-span-1 order-3 sm:order-none`}
              value={c.description}
              onChange={(e) => set(c.key, { description: e.target.value })}
            />
            <div className={compact ? "relative order-2" : "relative col-span-2 sm:col-span-1 order-4 sm:order-none"}>
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
              <input
                aria-label="Amount"
                type="number"
                min={0}
                step="1"
                placeholder="0"
                className={`${field} pl-6 text-right tabular-nums font-semibold`}
                value={c.amount}
                onChange={(e) => set(c.key, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x.key !== c.key))}
              className={`${compact ? "order-3 h-9 w-8" : "order-2 sm:order-none h-9 w-9"} inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50`}
              aria-label="Remove charge"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-line">
        <button type="button" onClick={() => onChange([...value, newCharge()])} className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
          <Plus className="w-4 h-4" /> Add another
        </button>
        <span className="text-sm text-slate-600">
          Total <b className="ml-1 tabular-nums text-slate-900">{formatINR(total)}</b>
        </span>
      </div>
    </div>
  );
}
