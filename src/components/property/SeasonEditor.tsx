"use client";

import { FieldArray, getIn, useFormikContext } from "formik";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { MEAL_PLAN_CODES } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { emptySeason, type RoomTypeInput } from "@/lib/validation/hotel.schema";

const input = "w-full h-8 px-2 text-xs bg-slate-50 border rounded-md focus:border-brand focus:outline-none";
const label = "block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1";

/**
 * Seasonal rates of a room type: name, dates (optionally every year), room rates per meal plan
 * and extra bed rates. A blank / 0 rate means the normal rate is used for that plan.
 */
export function SeasonEditor() {
  const { values, errors, touched, submitCount, setFieldValue } = useFormikContext<RoomTypeInput>();
  const seasons = values.seasons ?? [];
  const listError = typeof errors.seasons === "string" ? errors.seasons : undefined;

  const field = (i: number, key: string, type: "text" | "date" | "number", extra: Record<string, unknown> = {}) => {
    const name = `seasons.${i}.${key}`;
    const err = (submitCount > 0 || getIn(touched, name)) && (getIn(errors, name) as string | undefined);
    const value = getIn(values, name);
    return (
      <>
        <input
          type={type}
          name={name}
          aria-label={`${key} of season ${i + 1}`}
          value={type === "number" ? (value ? value : "") : (value ?? "")}
          placeholder={type === "number" ? "Normal" : undefined}
          onChange={(e) => setFieldValue(name, type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value)}
          className={`${input} ${err ? "border-rose-400" : "border-slate-300"}`}
          {...extra}
        />
        {err && <span className="block mt-0.5 text-[10.5px] text-rose-600">{err}</span>}
      </>
    );
  };

  return (
    <FieldArray name="seasons">
      {({ push, remove }) => (
        <div className="md:col-span-2 lg:col-span-3 space-y-3">
          {seasons.length === 0 && (
            <p className="text-xs text-slate-500">No seasons: the normal rates above are used all year. Add a season for peak / festival / off-season prices.</p>
          )}
          {seasons.map((s, i) => (
            <div key={i} className="border border-line rounded-lg bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-head border-b border-line rounded-t-lg">
                <span className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5" />
                  {s.name || `Season ${i + 1}`}
                  {s.from && s.to && (
                    <span className="normal-case tracking-normal font-medium text-slate-500">
                      · {s.yearly ? `${formatDay(s.from).replace(/\s\d{4}$/, "")} – ${formatDay(s.to).replace(/\s\d{4}$/, "")} every year` : `${formatDay(s.from)} – ${formatDay(s.to)}`}
                    </span>
                  )}
                </span>
                <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <span className={label}>Season Name *</span>
                    {field(i, "name", "text", { placeholder: "e.g. Peak Season", maxLength: 40 })}
                  </div>
                  <div>
                    <span className={label}>From (first night) *</span>
                    {field(i, "from", "date")}
                  </div>
                  <div>
                    <span className={label}>To (last night) *</span>
                    {field(i, "to", "date")}
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:pt-5">
                    <input
                      type="checkbox"
                      checked={Boolean(s.yearly)}
                      onChange={(e) => setFieldValue(`seasons.${i}.yearly`, e.target.checked)}
                      className="w-3.5 h-3.5 accent-brand"
                    />
                    Repeat every year
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {MEAL_PLAN_CODES.map((c) => (
                    <div key={c}>
                      <span className={label}>{c} Room Rate</span>
                      {field(i, `rates.${c}`, "number", { min: 0, step: 1 })}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {MEAL_PLAN_CODES.map((c) => (
                    <div key={c}>
                      <span className={label}>{c} Extra Bed</span>
                      {field(i, `extraBedRates.${c}`, "number", { min: 0, step: 1 })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {listError && <p className="text-[11px] font-medium text-rose-600">{listError}</p>}
          <button
            type="button"
            onClick={() => push({ ...emptySeason, rates: { ...emptySeason.rates }, extraBedRates: { ...emptySeason.extraBedRates } })}
            disabled={seasons.length >= 20}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-brand text-brand text-xs font-bold hover:bg-brand-light disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add Season
          </button>
        </div>
      )}
    </FieldArray>
  );
}
