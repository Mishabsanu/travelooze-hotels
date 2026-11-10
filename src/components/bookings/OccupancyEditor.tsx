"use client";

import { getIn, useFormikContext } from "formik";
import { AlertTriangle, BedSingle, Paperclip, RotateCcw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { MealPlan } from "@/lib/constants";
import { capacityLabel, formatINR } from "@/lib/format";
import type { AvailabilityType } from "@/lib/hotelTypes";
import { capacityProblem } from "@/lib/rooming";
import type { BookingInput } from "@/lib/validation/booking.schema";
import { ID_FILE_ACCEPT } from "@/services/bookingApi";

type Line = BookingInput["lines"][number];

const cell = "px-3 py-2 border-r border-line last:border-r-0";
const text = "w-full min-w-[150px] h-8 px-2 text-xs bg-slate-50 border rounded-md focus:border-brand focus:outline-none";
const num = "w-16 h-8 px-2 text-xs text-center bg-slate-50 border border-slate-300 rounded-md focus:border-brand focus:outline-none";

/** Spreads the pax evenly over the rooms (at least 1 adult each) and adds the extra beds each room needs. */
function spread(rooms: string[], adults: number, children: number, maxAdultsOf: (id: string) => number, old: Map<string, Line>): Line[] {
  const n = rooms.length;
  return rooms.map((id, i) => {
    const a = Math.max(1, Math.floor(adults / n) + (i < adults % n ? 1 : 0));
    const c = Math.floor(children / n) + (i < children % n ? 1 : 0);
    const prev = old.get(id);
    return { room: id, adults: a, children: c, extraBeds: Math.max(0, a - maxAdultsOf(id)), guests: prev?.guests ?? [] };
  });
}

/**
 * Guests per picked room. By default the Pax (adults / children) is spread over the rooms automatically;
 * staff can open the table to change any room, which switches to manual until "Spread again".
 */
export function OccupancyEditor({
  types,
  phoneRequired = true,
  idFiles,
  setIdFiles,
}: {
  types: AvailabilityType[];
  phoneRequired?: boolean;
  /** Aadhaar / ID files picked per room (uploaded to that room's guest after saving) */
  idFiles?: Record<string, File[]>;
  setIdFiles?: (room: string, files: File[]) => void;
}) {
  const { values, setFieldValue, errors, touched, submitCount, setFieldTouched } = useFormikContext<BookingInput>();
  const [auto, setAuto] = useState(true);
  const fieldError = (name: "guestName" | "phone") => ((submitCount > 0 || getIn(touched, name)) && (getIn(errors, name) as string | undefined)) || undefined;
  const mealPlan = values.mealPlan as MealPlan;
  const roomInfo = new Map(types.flatMap((t) => t.rooms.map((r) => [r._id, { type: t, number: r.number }] as const)));
  const adults = Math.max(0, Math.floor(Number(values.adults) || 0));
  const children = Math.max(0, Math.floor(Number(values.children) || 0));

  // Keep one line per picked room: spread automatically, or keep the manual numbers
  useEffect(() => {
    const old = new Map((values.lines ?? []).map((l) => [l.room, l]));
    const next: Line[] = auto
      ? spread(values.rooms, adults, children, (id) => roomInfo.get(id)?.type.maxAdults ?? 2, old)
      : values.rooms.map((id) => old.get(id) ?? { room: id, adults: 1, children: 0, extraBeds: Math.max(0, 1 - (roomInfo.get(id)?.type.maxAdults ?? 2)), guests: [] });
    const key = (ls: Line[]) => ls.map((l) => `${l.room}:${l.adults}:${l.children}:${l.extraBeds}`).join("|");
    if (key(next) !== key(values.lines ?? []) || next.length !== (values.lines ?? []).length) void setFieldValue("lines", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.rooms.join(","), adults, children, auto, types]);

  if (!values.rooms.length) {
    return (
      <p className="md:col-span-2 lg:col-span-3 text-xs text-slate-400">
        Pick rooms above: a table opens for guest names, phones and Aadhaar (all optional now, needed at check-in).
      </p>
    );
  }

  const set = (i: number, patch: Partial<Line>) => {
    setAuto(false);
    const next = [...values.lines];
    next[i] = { ...next[i], ...patch };
    void setFieldValue("lines", next);
  };
  const totalAdults = values.lines.reduce((s, l) => s + (Number(l.adults) || 0), 0);
  const totalChildren = values.lines.reduce((s, l) => s + (Number(l.children) || 0), 0);
  const totalBeds = values.lines.reduce((s, l) => s + (Number(l.extraBeds) || 0), 0);
  const mismatch = !auto && (totalAdults !== adults || totalChildren !== children);

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
          <Users className="w-3.5 h-3.5 text-brand" />
          {totalAdults} adult{totalAdults === 1 ? "" : "s"}
          {totalChildren ? `, ${totalChildren} child${totalChildren === 1 ? "" : "ren"}` : ""} in {values.lines.length} room{values.lines.length === 1 ? "" : "s"}
          <span className="font-normal text-slate-400">({values.lines.map((l) => Number(l.adults) + Number(l.children)).join(" + ")})</span>
        </span>
        {totalBeds > 0 && (
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <BedSingle className="w-3.5 h-3.5 text-brand" /> {totalBeds} extra bed{totalBeds === 1 ? "" : "s"}
          </span>
        )}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${auto ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{auto ? "AUTO" : "MANUAL"}</span>
        {!auto && (
          <button type="button" onClick={() => setAuto(true)} className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-brand">
            <RotateCcw className="w-3.5 h-3.5" /> Spread pax again
          </button>
        )}
      </div>
      {adults > 0 && adults < values.rooms.length && auto && (
        <p className="text-[11px] font-semibold text-amber-700">Pax is {adults} but {values.rooms.length} rooms are picked: each room needs at least 1 adult.</p>
      )}
      {mismatch && (
        <p className="text-[11px] font-semibold text-amber-700">
          Rooms hold {totalAdults} adult(s){totalChildren ? `, ${totalChildren} child(ren)` : ""}; pax says {adults}
          {children ? ` + ${children}` : ""}. The rooms are what is booked.
        </p>
      )}

      {(
        <div className="border border-line overflow-x-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${cell} text-left`}>Room</th>
                <th className={`${cell} text-center`}>Adults</th>
                <th className={`${cell} text-center`}>Children</th>
                <th className={`${cell} text-center`}>Extra Beds</th>
                <th className={`${cell} text-right`}>Extra Bed / Night</th>
                <th className={`${cell} text-left`}>
                  Guest Name <span className="normal-case font-medium text-slate-400">(optional)</span>
                </th>
                <th className={`${cell} text-left`}>Phone</th>
                {setIdFiles && <th className={`${cell} text-left`}>Aadhaar / ID</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {values.lines.map((l, i) => {
                const info = roomInfo.get(l.room);
                const t = info?.type;
                const problem = t ? capacityProblem(t, { adults: Number(l.adults) || 0, children: Number(l.children) || 0, extraBeds: Number(l.extraBeds) || 0 }) : null;
                const bedRate = t?.extraBedRates?.[mealPlan] ?? 0;
                return (
                  <tr key={l.room} className={problem ? "bg-rose-50/60" : ""}>
                    <td className={cell}>
                      <span className="font-mono font-bold text-slate-900">{info?.number ?? "—"}</span>
                      <span className="text-slate-400"> · {t?.name}</span>
                      {t && (
                        <span className="block text-[10px] text-slate-400">
                          max {capacityLabel(t.maxAdults, t.maxChildren ?? 2, t.maxExtraBeds ?? 1)}
                        </span>
                      )}
                    </td>
                    <td className={`${cell} text-center`}>
                      <input type="number" min={1} aria-label={`Adults in ${info?.number}`} className={num} value={l.adults} onChange={(e) => set(i, { adults: Number(e.target.value) })} />
                    </td>
                    <td className={`${cell} text-center`}>
                      <input type="number" min={0} aria-label={`Children in ${info?.number}`} className={num} value={l.children} onChange={(e) => set(i, { children: Number(e.target.value) })} />
                    </td>
                    <td className={`${cell} text-center`}>
                      <input
                        type="number"
                        min={0}
                        max={t?.maxExtraBeds ?? 1}
                        aria-label={`Extra beds in ${info?.number}`}
                        className={num}
                        value={l.extraBeds}
                        onChange={(e) => set(i, { extraBeds: Number(e.target.value) })}
                      />
                    </td>
                    <td className={`${cell} text-right tabular-nums text-slate-600`}>
                      {Number(l.extraBeds) > 0 ? (values.rateType === "per_head" ? "Included" : formatINR(bedRate * Number(l.extraBeds))) : "—"}
                    </td>
                    <td className={cell}>
                      {i === 0 ? (
                        // Room 1 = the booking's main guest (required)
                        <>
                          <input
                            type="text"
                            name="guestName"
                            placeholder={values.source === "agent" ? "Guest / group name" : "Main guest name"}
                            aria-label="Guest name"
                            maxLength={100}
                            className={`${text} ${fieldError("guestName") ? "border-rose-400" : "border-slate-300"}`}
                            value={values.guestName}
                            onChange={(e) => setFieldValue("guestName", e.target.value)}
                            onBlur={() => setFieldTouched("guestName", true)}
                          />
                          {fieldError("guestName") && <span className="block mt-0.5 text-[10.5px] font-semibold text-rose-600">{fieldError("guestName")}</span>}
                        </>
                      ) : (
                        <input
                          type="text"
                          placeholder="Optional"
                          aria-label={`Guest name for ${info?.number}`}
                          className={`${text} border-slate-300`}
                          value={l.guests?.[0]?.name ?? ""}
                          onChange={(e) => {
                            const next = [...values.lines];
                            next[i] = { ...next[i], guests: [{ _id: "", name: e.target.value, type: "adult", phone: l.guests?.[0]?.phone ?? "", aadhaar: "" }] };
                            void setFieldValue("lines", next);
                          }}
                        />
                      )}
                      {problem && (
                        <span className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-rose-600">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {problem.replace(/^Room\s\S+\s\([^)]*\):\s/, "")}
                        </span>
                      )}
                    </td>
                    <td className={cell}>
                      {i === 0 ? (
                        <>
                          <input
                            type="tel"
                            name="phone"
                            placeholder={phoneRequired ? "98XXXXXXXX" : "Blank = agent's phone"}
                            aria-label="Phone"
                            className={`${text} min-w-[130px] ${fieldError("phone") ? "border-rose-400" : "border-slate-300"}`}
                            value={values.phone}
                            onChange={(e) => setFieldValue("phone", e.target.value)}
                            onBlur={() => setFieldTouched("phone", true)}
                          />
                          {fieldError("phone") && <span className="block mt-0.5 text-[10.5px] font-semibold text-rose-600">{fieldError("phone")}</span>}
                        </>
                      ) : (
                        <input
                          type="tel"
                          placeholder="Optional"
                          aria-label={`Phone for ${info?.number}`}
                          className={`${text} min-w-[130px] border-slate-300`}
                          value={l.guests?.[0]?.phone ?? ""}
                          onChange={(e) => {
                            const next = [...values.lines];
                            next[i] = { ...next[i], guests: [{ _id: "", name: l.guests?.[0]?.name ?? "", type: "adult", phone: e.target.value, aadhaar: "" }] };
                            void setFieldValue("lines", next);
                          }}
                        />
                      )}
                    </td>
                    {setIdFiles && (
                      <td className={cell}>
                        <label
                          className={`inline-flex max-w-[170px] cursor-pointer items-center gap-1.5 h-8 px-2.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${
                            idFiles?.[l.room]?.length ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600 hover:border-brand hover:text-brand"
                          }`}
                          title={idFiles?.[l.room]?.map((f) => f.name).join(", ") || "Attach Aadhaar / ID (front & back, max 4 MB each)"}
                        >
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{idFiles?.[l.room]?.length ? `${idFiles[l.room].length} file(s)` : "Attach"}</span>
                          <input
                            type="file"
                            multiple
                            accept={ID_FILE_ACCEPT}
                            aria-label={`Aadhaar / ID for ${info?.number}`}
                            className="sr-only"
                            onChange={(e) => setIdFiles(l.room, Array.from(e.target.files ?? []))}
                          />
                        </label>
                        {i > 0 && Boolean(idFiles?.[l.room]?.length) && !l.guests?.[0]?.name?.trim() && (
                          <span className="block mt-0.5 text-[10.5px] font-semibold text-amber-700">Add the guest name</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
