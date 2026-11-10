"use client";

import { CheckCircle2, ChevronRight, Download, Loader2, Paperclip, Save, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { canBooking } from "@/lib/bookingAccess";
import { formatINR, paxLabel } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { ApiError } from "@/services/apiClient";
import { bookingApi, ID_FILE_ACCEPT, idFileProblem } from "@/services/bookingApi";

type Slot = { _id: string; name: string; type: "adult" | "child"; phone: string; aadhaar: string; aadhaarLast4: string; idFiles: string[] };
type Line = { room: string; roomNumber: string; roomTypeName: string; adults: number; children: number; extraBeds: number; extraBedRate: number; slots: Slot[] };

const td = "px-2 py-1 align-middle";
const input = "w-full h-7 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:border-brand focus:bg-white focus:outline-none disabled:bg-transparent disabled:border-transparent";
const num = "w-12 h-7 px-1 text-xs text-center bg-white border border-slate-300 rounded-md focus:border-brand focus:outline-none";

const empty = (type: Slot["type"]): Slot => ({ _id: "", name: "", type, phone: "", aadhaar: "", aadhaarLast4: "", idFiles: [] });

/** One row per adult and child of every room (saved guests first, empty rows for the rest). */
function toLines(b: Booking): Line[] {
  return b.rooms.map((r) => {
    const adults = r.guests.filter((g) => g.type === "adult");
    const kids = r.guests.filter((g) => g.type === "child");
    const slot = (g: (typeof r.guests)[number]): Slot => ({ _id: g._id, name: g.name, type: g.type, phone: g.phone, aadhaar: "", aadhaarLast4: g.aadhaarLast4 ?? "", idFiles: g.idFiles });
    return {
      room: r.room,
      roomNumber: r.roomNumber,
      roomTypeName: r.roomTypeName,
      adults: r.adults,
      children: r.children,
      extraBeds: r.extraBeds,
      extraBedRate: r.extraBedRate,
      slots: [
        ...adults.map(slot),
        ...Array.from({ length: Math.max(0, r.adults - adults.length) }, () => empty("adult")),
        ...kids.map(slot),
        ...Array.from({ length: Math.max(0, r.children - kids.length) }, () => empty("child")),
      ],
    };
  });
}

/** Resize a room's rows when its adults / children change (filled rows are kept). */
function resize(l: Line, adults: number, children: number): Line {
  const keep = (type: Slot["type"], n: number) => {
    const list = l.slots.filter((s) => s.type === type);
    const named = list.filter((s) => s.name.trim() || s._id);
    const rest = list.filter((s) => !(s.name.trim() || s._id));
    const out = [...named, ...rest].slice(0, Math.max(n, named.length));
    while (out.length < n) out.push(empty(type));
    return out;
  };
  return { ...l, adults, children, slots: [...keep("adult", adults), ...keep("child", children)] };
}

/**
 * Rooming list, edited right in the table: name, phone, Aadhaar and ID per guest (all optional).
 * Text changes are saved with "Save Guests"; an ID file uploads as soon as it is picked.
 */
export function RoomingList({ booking: b }: { booking: Booking }) {
  const user = useSession();
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() => toLines(b));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [openRooms, setOpenRooms] = useState<Set<number>>(() => {
    const slots = b.rooms.reduce((n, r) => n + r.adults + r.children, 0);
    return b.rooms.length <= 3 && slots <= 12 ? new Set(b.rooms.map((_, i) => i)) : new Set();
  });

  const open = b.status === "confirmed" || b.status === "checked_in";
  const canEditCounts = open && canBooking(user, b.source, "update");
  const canEdit = open && (canEditCounts || can(user, "check_in_out", "update"));
  const canUpload = open && can(user, "guest_id", "create");
  const canView = can(user, "guest_id", "view");
  const s = b.idStatus;

  const change = (li: number, si: number, patch: Partial<Slot>) => {
    setLines((ls) => ls.map((l, i) => (i === li ? { ...l, slots: l.slots.map((x, j) => (j === si ? { ...x, ...patch } : x)) } : l)));
    setDirty(true);
  };
  const changeCounts = (li: number, patch: { adults?: number; children?: number; extraBeds?: number }) => {
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== li) return l;
        const next = resize(l, Math.max(1, patch.adults ?? l.adults), Math.max(0, patch.children ?? l.children));
        return { ...next, extraBeds: Math.max(0, patch.extraBeds ?? l.extraBeds) };
      })
    );
    setDirty(true);
  };

  /** Saves the whole list; returns the saved booking. */
  const save = async (ls = lines): Promise<Booking> => {
    const res = await bookingApi.rooming(b._id, {
      lines: ls.map((l) => ({
        room: l.room,
        adults: l.adults,
        children: l.children,
        extraBeds: l.extraBeds,
        guests: l.slots.filter((x) => x.name.trim()).map((x) => ({ _id: x._id, name: x.name.trim(), type: x.type, phone: x.phone.trim(), aadhaar: x.aadhaar })),
      })),
    });
    setLines(toLines(res));
    setDirty(false);
    return res;
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await save();
      toast.success("Guests saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (li: number, si: number, files: File[]) => {
    if (!files.length) return;
    const slot = lines[li].slots[si];
    if (!slot.name.trim()) return toast.info("Type the guest's name first, then attach the ID");
    const problem = idFileProblem(files);
    if (problem) return toast.error(problem);
    const key = `${li}-${si}`;
    setUploading(key);
    try {
      // A new name is saved first so the file has a guest to belong to
      let guestId = slot._id;
      if (!guestId || dirty) {
        const saved = await save();
        const named = lines[li].slots.slice(0, si + 1).filter((x) => x.type === slot.type && x.name.trim()).length - 1;
        guestId = saved.rooms[li]?.guests.filter((g) => g.type === slot.type)[named]?._id ?? "";
      }
      if (!guestId) throw new ApiError("Could not find the guest to attach the ID to", 422);
      const res = await bookingApi.uploadGuestIds(b._id, guestId, files, slot.aadhaar);
      setLines(toLines(res));
      setDirty(false);
      toast.success(`ID saved for ${slot.name.trim()}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading("");
    }
  };

  const totalSlots = lines.reduce((n, l) => n + l.slots.length, 0);
  const named = lines.reduce((n, l) => n + l.slots.filter((x) => x.name.trim()).length, 0);
  const allOpen = openRooms.size === lines.length;
  const toggle = (li: number) =>
    setOpenRooms((o) => {
      const n = new Set(o);
      if (n.has(li)) n.delete(li);
      else n.add(li);
      return n;
    });

  return (
    <section id="rooming-list" className="space-y-2 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5 text-brand" />
          <b className="text-slate-800">Guests</b> · {named} of {totalSlots} named · {s.adultsWithId} ID{s.adultsWithId === 1 ? "" : "s"} · all optional
        </p>
        <div className="no-print flex items-center gap-2">
          {lines.length > 1 && (
            <button type="button" onClick={() => setOpenRooms(allOpen ? new Set() : new Set(lines.map((_, i) => i)))} className="text-[11px] font-bold text-brand hover:underline">
              {allOpen ? "Close all" : "Open all"}
            </button>
          )}
          {canEdit && dirty && (
            <Button size="sm" icon={<Save className="w-3.5 h-3.5" />} loading={busy} onClick={onSave}>
              Save Guests
            </Button>
          )}
        </div>
      </div>

      <div className="border border-line overflow-x-auto bg-white rounded-lg">
        <table className="w-full text-xs border-collapse min-w-[620px]">
          <tbody>
            {lines.map((l, li) => {
              const isOpen = openRooms.has(li);
              const filled = l.slots.filter((x) => x.name.trim()).length;
              const ids = l.slots.filter((x) => x.idFiles.length).length;
              return [
                <tr key={`h-${l.room}`} className={`border-t border-line first:border-t-0 bg-slate-50/80 ${isOpen ? "" : "hover:bg-slate-100"}`}>
                  <td colSpan={4} className="px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => toggle(li)}
                        aria-expanded={isOpen}
                        className="no-print inline-flex items-center gap-1.5 text-left"
                        title={isOpen ? "Close" : "Open to add names, phones, IDs"}
                      >
                        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition ${isOpen ? "rotate-90" : ""}`} />
                        <span className="font-mono font-bold text-slate-900">{l.roomNumber}</span>
                        <span className="text-slate-400">· {l.roomTypeName}</span>
                      </button>
                      <span className="text-slate-600">{paxLabel(l.adults, l.children)}</span>
                      {l.extraBeds > 0 && (
                        <span className="text-slate-500">
                          +{l.extraBeds} extra bed{l.extraBeds === 1 ? "" : "s"}
                          {l.extraBedRate ? ` (${formatINR(l.extraBedRate)}/night)` : ""}
                        </span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filled === l.slots.length ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {filled}/{l.slots.length} named
                      </span>
                      {ids > 0 && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{ids} ID</span>}
                      {canEditCounts && isOpen && (
                        <span className="no-print ml-auto flex items-center gap-2 text-[10.5px] text-slate-500">
                          {(
                            [
                              ["adults", "Adults", 1],
                              ["children", "Children", 0],
                              ["extraBeds", "Extra beds", 0],
                            ] as const
                          ).map(([k, label, min]) => (
                            <label key={k} className="flex items-center gap-1">
                              {label}
                              <input type="number" min={min} aria-label={`${label} in ${l.roomNumber}`} className={num} value={l[k]} onChange={(e) => changeCounts(li, { [k]: Number(e.target.value) })} />
                            </label>
                          ))}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>,
                ...(isOpen
                  ? l.slots.map((slot, si) => {
                      const key = `${li}-${si}`;
                      return (
                        <tr key={`${l.room}-${si}`} className="border-t border-line/70">
                          <td className={`${td} pl-7`}>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-11 shrink-0 text-center rounded px-1 py-0.5 text-[9.5px] font-bold uppercase ${slot.type === "adult" ? "bg-brand-light text-brand" : "bg-amber-50 text-amber-700"}`}>
                                {slot.type === "adult" ? "Adult" : "Child"}
                              </span>
                              <input
                                className={`${input} min-w-[140px]`}
                                placeholder="Name"
                                aria-label={`Guest name, room ${l.roomNumber} row ${si + 1}`}
                                maxLength={100}
                                disabled={!canEdit}
                                value={slot.name}
                                onChange={(e) => change(li, si, { name: e.target.value })}
                              />
                            </div>
                          </td>
                          <td className={td}>
                            <input
                              type="tel"
                              className={`${input} min-w-[110px]`}
                              placeholder="Phone"
                              aria-label={`Phone, room ${l.roomNumber} row ${si + 1}`}
                              disabled={!canEdit}
                              value={slot.phone}
                              onChange={(e) => change(li, si, { phone: e.target.value })}
                            />
                          </td>
                          <td className={td}>
                            <input
                              inputMode="numeric"
                              maxLength={14}
                              className={`${input} min-w-[120px] font-mono`}
                              placeholder={slot.aadhaarLast4 ? `XXXX XXXX ${slot.aadhaarLast4}` : "Aadhaar no."}
                              aria-label={`Aadhaar, room ${l.roomNumber} row ${si + 1}`}
                              disabled={!canEdit}
                              value={slot.aadhaar}
                              onChange={(e) => change(li, si, { aadhaar: e.target.value })}
                            />
                          </td>
                          <td className={`${td} w-[150px]`}>
                            <div className="flex flex-wrap items-center gap-2">
                              {slot.idFiles.length > 0 &&
                                (canView && slot._id ? (
                                  slot.idFiles.map((_, i) => (
                                    <a
                                      key={i}
                                      href={`/api/bookings/${b._id}/guests/${slot._id}/files/${i}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="no-print inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                                    >
                                      <Download className="w-3 h-3" /> ID {i + 1}
                                    </a>
                                  ))
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-700">
                                    <CheckCircle2 className="w-3 h-3" /> {slot.idFiles.length} on file
                                  </span>
                                ))}
                              {canUpload && (
                                <label
                                  className={`no-print inline-flex cursor-pointer items-center gap-1 h-7 px-2 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:border-brand hover:text-brand ${uploading ? "pointer-events-none opacity-60" : ""}`}
                                  title="Aadhaar / ID: JPG, PNG or PDF, max 4 MB each"
                                >
                                  {uploading === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                                  {slot.idFiles.length ? "Add" : "ID"}
                                  <input
                                    type="file"
                                    multiple
                                    accept={ID_FILE_ACCEPT}
                                    className="sr-only"
                                    aria-label={`ID, room ${l.roomNumber} row ${si + 1}`}
                                    onChange={(e) => {
                                      void onUpload(li, si, Array.from(e.target.files ?? []));
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : []),
              ];
            })}
          </tbody>
        </table>
      </div>
      {canEdit && dirty && (
        <div className="no-print flex items-center justify-end gap-2 text-[11px] text-amber-700">
          Unsaved changes
          <Button size="sm" icon={<Save className="w-3.5 h-3.5" />} loading={busy} onClick={onSave}>
            Save Guests
          </Button>
        </div>
      )}
    </section>
  );
}
