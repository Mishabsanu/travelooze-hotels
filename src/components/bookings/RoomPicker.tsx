"use client";

import { useFormikContext } from "formik";
import { AlertCircle, BedDouble, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { MealPlan } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { AvailabilityType } from "@/lib/hotelTypes";
import type { BookingInput } from "@/lib/validation/booking.schema";
import { ApiError } from "@/services/apiClient";
import { bookingApi } from "@/services/bookingApi";

/**
 * Loads free rooms whenever hotel / dates change and lets the user tick rooms.
 * Reports the loaded types upward so the summary can price the selection.
 */
export function RoomPicker({ onTypes }: { onTypes: (types: AvailabilityType[], nights: number) => void }) {
  const { values, setFieldValue, errors, touched, submitCount } = useFormikContext<BookingInput>();
  const { hotel, checkIn, checkOut } = values;
  const ready = Boolean(hotel && checkIn && checkOut && checkOut > checkIn);
  const key = ready ? `${hotel}|${checkIn}|${checkOut}` : "";
  // Result of the last finished lookup, tagged with the query it answers
  const [result, setResult] = useState<{ key: string; types: AvailabilityType[]; problem: string }>({ key: "", types: [], problem: "" });
  const loading = ready && result.key !== key;
  const types = ready && result.key === key ? result.types : [];
  const problem = result.key === key ? result.problem : "";

  useEffect(() => {
    if (!ready) {
      onTypes([], 0);
      return;
    }
    let cancelled = false;
    bookingApi
      .availability(hotel, checkIn, checkOut)
      .then((res) => {
        if (cancelled) return;
        setResult({ key, types: res.types, problem: "" });
        onTypes(res.types, res.nights);
        // Keep only rooms that are still free
        const free = new Set(res.types.flatMap((t) => t.rooms.map((r) => r._id)));
        setFieldValue("rooms", (values.rooms ?? []).filter((id) => free.has(id)));
      })
      .catch((e) => !cancelled && setResult({ key, types: [], problem: e instanceof ApiError ? e.message : "Could not load rooms" }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const selected = new Set(values.rooms ?? []);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void setFieldValue("rooms", [...next]);
  };
  const error = (touched.rooms || submitCount > 0) && typeof errors.rooms === "string" ? errors.rooms : undefined;
  const plan = values.mealPlan as MealPlan;

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-3">
      {loading && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Checking free rooms…
        </p>
      )}
      {problem && <p className="text-xs text-rose-600">{problem}</p>}
      {!loading && hotel && types.length === 0 && !problem && (
        <p className="text-xs text-slate-500">No active room types in this hotel. Add them under Property → Room Types.</p>
      )}
      {!hotel && <p className="text-xs text-slate-500">Select a hotel to see free rooms.</p>}

      {types.map((t) => (
        <div key={t._id} className="border border-line">
          <div className="px-3 py-1.5 bg-head border-b border-line flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
              <BedDouble className="w-3.5 h-3.5" />
              {t.name}
              <span className="text-slate-400 normal-case font-medium tracking-normal">· up to {t.maxAdults} adults</span>
            </span>
            <span className="text-[11px] text-slate-600">
              <b className="tabular-nums">{formatINR(t.rates?.[plan])}</b> / night ({plan}) ·{" "}
              <span className={t.rooms.length ? "text-emerald-700 font-semibold" : "text-rose-600 font-semibold"}>
                {t.rooms.length ? `${t.rooms.length} free` : "Sold out"}
              </span>
            </span>
          </div>
          <div className="p-2.5 flex flex-wrap gap-1.5 bg-white">
            {t.rooms.map((r) => {
              const on = selected.has(r._id);
              return (
                <button
                  key={r._id}
                  type="button"
                  onClick={() => toggle(r._id)}
                  aria-pressed={on}
                  title={r.floor ? `Floor ${r.floor}` : undefined}
                  className={`min-w-[52px] h-8 px-2.5 rounded-md border text-xs font-bold font-mono transition ${
                    on ? "bg-brand border-brand-dark text-white" : "bg-slate-50 border-slate-300 text-slate-700 hover:border-brand hover:text-brand"
                  }`}
                >
                  {r.number}
                </button>
              );
            })}
            {t.rooms.length === 0 && <span className="text-[11px] text-slate-400 px-1">No free rooms for these dates</span>}
          </div>
        </div>
      ))}

      {error && (
        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5" role="alert">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
