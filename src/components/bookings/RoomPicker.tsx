"use client";

import { useFormikContext } from "formik";
import { AlertCircle, BedDouble, BedSingle, Check, Loader2, User } from "lucide-react";
import { toast } from "sonner";
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
export function RoomPicker({
  onTypes,
  perRoom,
  pickRequest,
  onPickDone,
}: {
  onTypes: (types: AvailabilityType[], nights: number) => void;
  /** Guests per room (2 double, 3 triple, 4 quad) used to work out how many rooms the pax needs */
  perRoom: number;
  /** Rooms to tick automatically once the free rooms are loaded (from a pasted agent message) */
  pickRequest: number;
  onPickDone: () => void;
}) {
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
  const totalFree = types.reduce((n, t) => n + t.rooms.length, 0);
  /** Tick the first N free rooms, rooms that can hold the sharing (with extra beds) first */
  const autoPick = (want: number, list: AvailabilityType[] = types) => {
    if (want < 1) return;
    const fits = (t: AvailabilityType) => t.maxAdults + (t.maxExtraBeds ?? 1) >= perRoom;
    const ordered = [...list.filter(fits), ...list.filter((t) => !fits(t))].flatMap((t) => t.rooms.map((r) => r._id));
    if (ordered.length < want) toast.warning(`Only ${ordered.length} room(s) free for these dates, ${want} needed`);
    void setFieldValue("rooms", ordered.slice(0, want));
  };
  // A pasted agent message asked for N rooms: pick them as soon as the free rooms are known
  useEffect(() => {
    if (pickRequest > 0 && types.length) {
      autoPick(pickRequest);
      onPickDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickRequest, types]);
  const error = (touched.rooms || submitCount > 0) && typeof errors.rooms === "string" ? errors.rooms : undefined;
  const mealPlan = values.mealPlan as MealPlan;

  return (
    <div className="col-span-full space-y-3">
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

      {types.length > 0 && (
        <p className="text-xs text-slate-500">
          Tap the rooms to book ·{" "}
          <b className={selected.size ? "text-brand" : "text-slate-700"}>
            {selected.size} selected
          </b>{" "}
          · {totalFree} free
        </p>
      )}

      {types.map((t) => {
        const picked = t.rooms.filter((r) => selected.has(r._id)).length;
        return (
          <div key={t._id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-brand">
                  <BedDouble className="h-4.5 w-4.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-slate-900">
                    {t.name}
                    {t.seasons?.length > 0 && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-800" title={`Normal rate ${formatINR(t.normalRates?.[mealPlan])}`}>
                        {t.seasons.join(" + ")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {t.maxAdults} adult{t.maxAdults === 1 ? "" : "s"}
                    </span>
                    {(t.maxExtraBeds ?? 1) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <BedSingle className="h-3 w-3" /> +{t.maxExtraBeds ?? 1} extra bed{(t.maxExtraBeds ?? 1) === 1 ? "" : "s"}
                      </span>
                    )}
                    {(t.maxChildren ?? 2) > 0 && <span>+{t.maxChildren ?? 2} children</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right leading-tight">
                  <p className="text-sm font-black tabular-nums text-slate-900">{formatINR(t.rates?.[mealPlan])}</p>
                  <p className="text-[10.5px] text-slate-500">per night · {mealPlan}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    !t.rooms.length ? "bg-rose-50 text-rose-700" : picked ? "bg-brand text-white" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {!t.rooms.length ? "Sold out" : picked ? `${picked} of ${t.rooms.length}` : `${t.rooms.length} free`}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {t.rooms.map((r) => {
                const on = selected.has(r._id);
                return (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => toggle(r._id)}
                    aria-pressed={on}
                    title={r.floor ? `Floor ${r.floor}` : undefined}
                    className={`relative flex h-10 min-w-[60px] flex-col items-center justify-center rounded-lg border px-2.5 transition ${
                      on ? "border-brand-dark bg-brand text-white shadow-xs" : "border-slate-200 bg-white text-slate-700 hover:border-brand hover:bg-brand-light/40 hover:text-brand"
                    }`}
                  >
                    {on && <Check className="absolute right-1 top-1 h-3 w-3" />}
                    <span className="font-mono text-sm font-bold leading-none">{r.number}</span>
                  </button>
                );
              })}
              {t.rooms.length === 0 && <span className="px-1 text-[11px] text-slate-400">No free rooms for these dates</span>}
            </div>
          </div>
        );
      })}

      {error && (
        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5" role="alert">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
