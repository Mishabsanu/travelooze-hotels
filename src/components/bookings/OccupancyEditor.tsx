"use client";

import { useFormikContext } from "formik";
import { AlertTriangle, BedSingle, Users, Wand2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import type { MealPlan } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { AvailabilityType } from "@/lib/hotelTypes";
import { capacityProblem } from "@/lib/rooming";
import type { BookingInput } from "@/lib/validation/booking.schema";
import type { GroupPlan } from "./AgentMessagePanel";

type Line = BookingInput["lines"][number];

const cell = "px-3 py-2 border-r border-line last:border-r-0";
const num = "w-16 h-8 px-2 text-xs text-center bg-slate-50 border border-slate-300 rounded-md focus:border-brand focus:outline-none";

/**
 * Per selected room: adults, children, extra beds and an optional guest name.
 * Keeps `lines` in step with the picked rooms. Full guest names / IDs can be completed later on the booking.
 */
const SHARING_OPTIONS = [
  { value: 1, label: "Single (1)" },
  { value: 2, label: "Double (2)" },
  { value: 3, label: "Triple (3)" },
  { value: 4, label: "Quad (4)" },
  { value: 5, label: "5 per room" },
  { value: 6, label: "6 per room" },
];

export function OccupancyEditor({ types, plan, setPlan }: { types: AvailabilityType[]; plan?: GroupPlan; setPlan?: (p: GroupPlan) => void }) {
  const { values, setFieldValue } = useFormikContext<BookingInput>();
  const mealPlan = values.mealPlan as MealPlan;
  const roomInfo = new Map(types.flatMap((t) => t.rooms.map((r) => [r._id, { type: t, number: r.number }] as const)));

  // One line per picked room (new rooms start full: up to 2 adults)
  useEffect(() => {
    const current = new Map((values.lines ?? []).map((l) => [l.room, l]));
    const next: Line[] = values.rooms.map((id, i) => {
      const old = current.get(id);
      if (old) return old;
      const t = roomInfo.get(id)?.type;
      return { room: id, adults: Math.min(2, t?.maxAdults ?? 2), children: 0, extraBeds: 0, guests: i === 0 ? [] : [{ _id: "", name: "", type: "adult", phone: "" }] };
    });
    const same = next.length === (values.lines ?? []).length && next.every((l, i) => l === values.lines[i]);
    if (!same) void setFieldValue("lines", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.rooms.join(","), types]);

  if (!values.rooms.length) return <p className="md:col-span-2 lg:col-span-3 text-xs text-slate-400">Pick rooms above to set the guests in each room.</p>;

  const set = (i: number, patch: Partial<Line>) => {
    const next = [...values.lines];
    next[i] = { ...next[i], ...patch };
    void setFieldValue("lines", next);
  };
  /** Group fill: spread N guests over the rooms at the chosen sharing, adding the extra beds needed */
  const groupFill = () => {
    if (!plan) return;
    let left = plan.guests;
    const next = values.lines.map((l, i) => {
      const t = roomInfo.get(l.room)?.type;
      const roomsAfter = values.lines.length - i - 1;
      const n = Math.max(1, Math.min(plan.perRoom, left - roomsAfter));
      left -= n;
      const extraBeds = Math.max(0, n - (t?.maxAdults ?? 2));
      return { ...l, adults: n, children: 0, extraBeds };
    });
    void setFieldValue("lines", next);
    if (left > 0) toast.warning(`${left} guest(s) do not fit at ${plan.perRoom} per room: pick more rooms`);
  };
  const totalAdults = values.lines.reduce((s, l) => s + (Number(l.adults) || 0), 0);
  const totalChildren = values.lines.reduce((s, l) => s + (Number(l.children) || 0), 0);
  const totalBeds = values.lines.reduce((s, l) => s + (Number(l.extraBeds) || 0), 0);

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-2">
      {plan && setPlan && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Wand2 className="w-3.5 h-3.5 text-brand" />
          <span>Group fill:</span>
          <input
            type="number"
            min={1}
            aria-label="Total guests"
            value={plan.guests || ""}
            onChange={(e) => setPlan({ ...plan, guests: Math.max(0, Number(e.target.value) || 0) })}
            className="w-16 h-8 px-2 text-center bg-slate-50 border border-slate-300 rounded-md focus:border-brand focus:outline-none"
          />
          <span>guests,</span>
          <select
            aria-label="Guests per room"
            value={plan.perRoom}
            onChange={(e) => setPlan({ ...plan, perRoom: Number(e.target.value) })}
            className="h-8 px-2 bg-slate-50 border border-slate-300 rounded-md focus:border-brand focus:outline-none"
          >
            {SHARING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={groupFill}
            disabled={!plan.guests}
            className="h-8 px-3 rounded-lg border border-brand text-brand font-bold hover:bg-brand-light disabled:opacity-40"
          >
            Fill Rooms
          </button>
          <span className="text-slate-400">adds the extra beds each room needs</span>
        </div>
      )}
      <div className="border border-line overflow-x-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${cell} text-left`}>Room</th>
              <th className={`${cell} text-center`}>Adults</th>
              <th className={`${cell} text-center`}>Children</th>
              <th className={`${cell} text-center`}>Extra Beds</th>
              <th className={`${cell} text-right`}>Extra Bed / Night</th>
              <th className={`${cell} text-left`}>Guest Name (optional now)</th>
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
                        max {t.maxAdults}A + {t.maxChildren ?? 2}C + {t.maxExtraBeds ?? 1} extra bed
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
                  <td className={`${cell} text-right tabular-nums text-slate-600`}>{Number(l.extraBeds) > 0 ? (values.rateType === "per_head" ? "Included" : formatINR(bedRate * Number(l.extraBeds))) : "—"}</td>
                  <td className={cell}>
                    {i === 0 && !l.guests?.[0]?.name ? (
                      <span className="text-[11px] text-slate-400">Lead guest below</span>
                    ) : (
                      <input
                        type="text"
                        placeholder="Name of a guest in this room"
                        aria-label={`Guest name for ${info?.number}`}
                        className="w-full min-w-[160px] h-8 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:border-brand focus:outline-none"
                        value={l.guests?.[0]?.name ?? ""}
                        onChange={(e) => set(i, { guests: [{ _id: "", name: e.target.value, type: "adult", phone: "" }] })}
                      />
                    )}
                    {problem && (
                      <span className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-rose-600">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {problem.replace(/^Room\s\S+\s\([^)]*\):\s/, "")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-brand" /> {totalAdults} adult(s), {totalChildren} child(ren) in {values.lines.length} room(s)
        </span>
        {totalBeds > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <BedSingle className="w-3.5 h-3.5 text-brand" /> {totalBeds} extra bed(s)
          </span>
        )}
        <span>Every adult needs a name and an ID before check-in. Big groups: add the names on the booking later.</span>
      </p>
    </div>
  );
}
