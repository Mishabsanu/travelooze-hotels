"use client";

import { useFormikContext } from "formik";
import { AlertCircle, BedDouble, Loader2, Wand2 } from "lucide-react";
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
  setPerRoom,
  pickRequest,
  onPickDone,
}: {
  onTypes: (types: AvailabilityType[], nights: number) => void;
  /** Guests per room (2 double, 3 triple, 4 quad) used to work out how many rooms the pax needs */
  perRoom: number;
  setPerRoom: (n: number) => void;
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
  const pax = Math.max(0, Math.floor(Number(values.adults) || 0)) + Math.max(0, Math.floor(Number(values.children) || 0));
  const needed = pax > 0 ? Math.ceil(pax / Math.max(1, perRoom)) : 0;
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

      {types.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-light/50 px-3 py-2 text-xs text-slate-700">
          <Wand2 className="w-3.5 h-3.5 text-brand" />
          <b>{pax || "—"} pax</b>
          <span>at</span>
          <select
            aria-label="Guests per room"
            value={perRoom}
            onChange={(e) => setPerRoom(Number(e.target.value))}
            className="h-8 px-2 bg-white border border-slate-300 rounded-md focus:border-brand focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} per room{n === 2 ? " (double)" : n === 3 ? " (triple)" : n === 4 ? " (quad)" : ""}
              </option>
            ))}
          </select>
          <span>
            = <b>{needed}</b> room{needed === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => autoPick(needed)}
            disabled={!needed}
            className="h-8 px-3 rounded-lg bg-brand text-white font-bold hover:bg-brand-dark disabled:opacity-40"
          >
            Pick {needed || ""} Room{needed === 1 ? "" : "s"}
          </button>
          <span className="text-slate-500">
            or tap rooms below · {selected.size} selected · {types.reduce((s, t) => s + t.rooms.length, 0)} free
          </span>
        </div>
      )}

      {types.map((t) => (
        <div key={t._id} className="border border-line">
          <div className="px-3 py-1.5 bg-head border-b border-line flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
              <BedDouble className="w-3.5 h-3.5" />
              {t.name}
              <span className="text-slate-400 normal-case font-medium tracking-normal">· up to {t.maxAdults} adults</span>
            </span>
            <span className="text-[11px] text-slate-600">
              {t.seasons?.length > 0 && (
                <span className="mr-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800" title={`Normal rate ${formatINR(t.normalRates?.[mealPlan])}`}>
                  {t.seasons.join(" + ")}
                </span>
              )}
              <b className="tabular-nums">{formatINR(t.rates?.[mealPlan])}</b> / night ({mealPlan}) ·{" "}
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
