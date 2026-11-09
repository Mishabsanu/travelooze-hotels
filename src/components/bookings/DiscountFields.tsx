"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { formatINR } from "@/lib/format";
import { round2 } from "@/lib/pricing";

const adjInput = "w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:border-brand focus:outline-none tabular-nums";

/**
 * Discount % and "Adjusted price": type either one. A typed price is turned into the discount %
 * (on the room / package charges before GST), so the bill, GST and reports stay consistent.
 */
export function DiscountFields(p: {
  gross: number;
  discount: number;
  net: number;
  defaultDiscount: number;
  defaultLabel: string;
  edited: boolean;
  onPercent: (v: number | null) => void;
}) {
  // While typing a price keep the raw text; otherwise show the price that the % gives
  const [priceText, setPriceText] = useState<string | null>(null);
  return (
    <>
      <FormField label="Discount %" hint={
          p.edited
            ? `Changed (was ${p.defaultDiscount}%)`
            : p.defaultLabel === "current"
              ? `Current ${p.defaultDiscount}%`
              : `Default: ${p.defaultLabel === "contract" ? `agent contract ${p.defaultDiscount}%` : "none"}`
        }>
        <div className="flex gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            aria-label="Discount percent"
            className={adjInput}
            value={Number.isFinite(p.discount) ? round2(p.discount) : ""}
            onChange={(e) => {
              setPriceText(null);
              const v = e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
              p.onPercent(v);
            }}
          />
          {p.edited && (
            <button
              type="button"
              onClick={() => {
                setPriceText(null);
                p.onPercent(null);
              }}
              className="shrink-0 h-9 px-2.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
              title="Back to the default discount"
            >
              Reset
            </button>
          )}
        </div>
      </FormField>
      <FormField label="Adjusted Price (₹, before GST)" hint={p.gross ? `List price ${formatINR(p.gross)} → ${round2(p.discount)}% off` : "Pick rooms first"}>
        <input
          type="number"
          min={0}
          step="1"
          aria-label="Adjusted price before GST"
          disabled={!p.gross}
          className={adjInput}
          value={priceText ?? (p.gross ? round2(p.net) : "")}
          onChange={(e) => {
            setPriceText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value === "" || !Number.isFinite(v) || !p.gross) return;
            // Price above list = no discount (a higher price needs a rate change, not a negative discount)
            const pct = Math.min(100, Math.max(0, (1 - v / p.gross) * 100));
            p.onPercent(Math.round(pct * 10000) / 10000);
          }}
          onBlur={() => setPriceText(null)}
        />
      </FormField>
    </>
  );
}
