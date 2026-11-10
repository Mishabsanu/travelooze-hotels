"use client";

import { CheckCircle2, LogIn, Paperclip } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, inputClass } from "@/components/ui/FormField";
import type { Booking } from "@/lib/hotelTypes";
import { parseIstLocal, stayMoment, timeLabel, toIstLocal } from "@/lib/stayTimes";
import { bookingApi, ID_FILE_ACCEPT, idFileProblem } from "@/services/bookingApi";

type Row = {
  key: string;
  roomIdx: number;
  /** nth adult of the room */
  slot: number;
  roomNumber: string;
  guestId: string;
  name: string;
  phone: string;
  aadhaar: string;
  hasId: boolean;
  files: File[];
};

const cell = "px-2.5 py-1.5 border-r border-line last:border-r-0 align-top";
const text = "w-full h-8 px-2 text-xs bg-slate-50 border rounded-md focus:border-brand focus:outline-none";

function buildRows(b: Booking): Row[] {
  const rows: Row[] = [];
  b.rooms.forEach((r, roomIdx) => {
    const adults = r.guests.filter((g) => g.type === "adult");
    for (let slot = 0; slot < r.adults; slot++) {
      const g = adults[slot];
      const lead = roomIdx === 0 && slot === 0;
      rows.push({
        key: `${r.room}-${slot}`,
        roomIdx,
        slot,
        roomNumber: r.roomNumber,
        guestId: g?._id ?? "",
        name: g?.name ?? (lead && b.guest.name !== "Walk-in guest" && b.source === "walkin" ? b.guest.name : ""),
        phone: g?.phone || (lead ? b.guest.phone : ""),
        aadhaar: "",
        hasId: (g?.idFiles?.length ?? 0) > 0,
        files: [],
      });
    }
  });
  return rows;
}

/**
 * Check-in in one step: every adult's name, phone, Aadhaar and ID are filled right here
 * (whatever is already on the booking is pre-filled), then the guests are checked in.
 */
export function CheckInForm({ b, busy, run }: { b: Booking; busy: boolean; run: (fn: () => Promise<unknown>, message: string) => Promise<void> }) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(b));
  const [at, setAt] = useState(toIstLocal());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const set = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    // Clear that row's message as soon as it is being fixed
    const key = rows[i]?.key;
    if (key && errors[key]) setErrors(({ [key]: _, ...rest }) => (void _, rest));
    if (formError && ("phone" in patch || "name" in patch || "files" in patch)) setFormError("");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    rows.forEach((r) => {
      if (!r.name.trim()) e[r.key] = "Name needed";
      else if (!r.hasId && !r.files.length) e[r.key] = "ID needed";
      else {
        const p = idFileProblem(r.files);
        if (p) e[r.key] = p;
      }
    });
    const phoneOk = rows.some((r) => r.phone.trim()) || Boolean(b.guest.phone);
    setErrors(e);
    setFormError(!phoneOk ? "Enter at least the main guest's phone number" : Object.keys(e).length ? "Fill the name and ID of every adult" : "");
    return phoneOk && !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    void run(async () => {
      // 1. Save names / phones (children and room counts stay as they are)
      const lines = b.rooms.map((r, roomIdx) => ({
        room: r.room,
        adults: r.adults,
        children: r.children,
        extraBeds: r.extraBeds,
        guests: [
          ...rows.filter((x) => x.roomIdx === roomIdx).map((x) => ({ _id: x.guestId, name: x.name.trim(), type: "adult" as const, phone: x.phone.trim() })),
          ...r.guests.filter((g) => g.type === "child").map((g) => ({ _id: g._id, name: g.name, type: "child" as const, phone: g.phone })),
        ],
      }));
      let saved = await bookingApi.rooming(b._id, { lines });
      // 2. Upload the IDs picked here, to the right guest
      for (const x of rows.filter((r) => r.files.length)) {
        const guest = saved.rooms[x.roomIdx]?.guests.filter((g) => g.type === "adult")[x.slot];
        if (guest) saved = await bookingApi.uploadGuestIds(b._id, guest._id, x.files, x.aadhaar);
      }
      // 3. Check in
      return bookingApi.checkIn(b._id, at);
    }, "Guest checked in");
  };

  const early = (() => {
    const when = parseIstLocal(at);
    const std = stayMoment(b.checkIn, b.hotel?.checkInTime || "12:00");
    return when && when < std ? `Early check-in: before the ${timeLabel(b.hotel?.checkInTime || "12:00")} check-in time` : "";
  })();

  return (
    <div className="space-y-3 text-xs text-slate-600">
      <div className="border border-line overflow-x-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${cell} text-left`}>Room</th>
              <th className={`${cell} text-left`}>Guest Name</th>
              <th className={`${cell} text-left`}>Phone</th>
              <th className={`${cell} text-left`}>Aadhaar No.</th>
              <th className={`${cell} text-left`}>Aadhaar / ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => {
              const err = errors[r.key];
              return (
                <tr key={r.key} className={err ? "bg-rose-50/60" : ""}>
                  <td className={`${cell} whitespace-nowrap`}>
                    <span className="font-mono font-bold text-slate-900">{r.roomNumber}</span>
                    <span className="block text-[10px] text-slate-400">Adult {r.slot + 1}</span>
                  </td>
                  <td className={cell}>
                    <input
                      aria-label={`Name, room ${r.roomNumber} adult ${r.slot + 1}`}
                      className={`${text} min-w-[150px] ${err === "Name needed" ? "border-rose-400" : "border-slate-300"}`}
                      value={r.name}
                      maxLength={100}
                      onChange={(e) => set(i, { name: e.target.value })}
                    />
                    {err && <span className="block mt-0.5 text-[10.5px] font-semibold text-rose-600">{err}</span>}
                  </td>
                  <td className={cell}>
                    <input
                      type="tel"
                      aria-label={`Phone, room ${r.roomNumber} adult ${r.slot + 1}`}
                      className={`${text} min-w-[120px] border-slate-300`}
                      placeholder={i === 0 ? "Main guest phone" : "Optional"}
                      value={r.phone}
                      onChange={(e) => set(i, { phone: e.target.value })}
                    />
                  </td>
                  <td className={cell}>
                    <input
                      inputMode="numeric"
                      aria-label={`Aadhaar, room ${r.roomNumber} adult ${r.slot + 1}`}
                      className={`${text} min-w-[130px] border-slate-300`}
                      placeholder="Optional"
                      maxLength={14}
                      value={r.aadhaar}
                      onChange={(e) => set(i, { aadhaar: e.target.value })}
                    />
                  </td>
                  <td className={cell}>
                    {r.hasId && !r.files.length ? (
                      <span className="inline-flex h-8 items-center gap-1 font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> On file
                      </span>
                    ) : (
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1.5 h-8 px-2.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${
                          r.files.length ? "border-emerald-300 bg-emerald-50 text-emerald-700" : err === "ID needed" ? "border-rose-400 bg-white text-rose-600" : "border-slate-300 bg-white text-slate-600 hover:border-brand hover:text-brand"
                        }`}
                        title={r.files.map((f) => f.name).join(", ") || "Front & back, max 4 MB each"}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {r.files.length ? `${r.files.length} file(s)` : "Attach"}
                        <input
                          type="file"
                          multiple
                          accept={ID_FILE_ACCEPT}
                          className="sr-only"
                          aria-label={`ID, room ${r.roomNumber} adult ${r.slot + 1}`}
                          onChange={(e) => set(i, { files: Array.from(e.target.files ?? []) })}
                        />
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <FormField label="Actual Check-in Time" required hint={`Expected ${timeLabel(b.arrivalTime || b.hotel?.checkInTime || "12:00")}`}>
          <input type="datetime-local" className={inputClass(false)} value={at} max={toIstLocal()} onChange={(e) => setAt(e.target.value)} />
        </FormField>
        <Button className="w-full" loading={busy} icon={<LogIn className="w-4 h-4" />} onClick={submit}>
          Check In {rows.length} Guest{rows.length === 1 ? "" : "s"}
        </Button>
      </div>
      {early && <p className="text-[11px] font-semibold text-amber-700">{early}</p>}
      {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}
    </div>
  );
}
