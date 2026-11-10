"use client";

import { CheckCircle2, Download, IdCard, Plus, Trash2, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { FormField, inputClass } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { canBooking } from "@/lib/bookingAccess";
import { formatINR, paxLabel } from "@/lib/format";
import type { Booking, BookingGuest } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { ApiError } from "@/services/apiClient";
import { bookingApi, ID_FILE_ACCEPT, idFileProblem } from "@/services/bookingApi";

type EditLine = { room: string; roomNumber: string; adults: number; children: number; extraBeds: number; guests: { _id: string; name: string; type: "adult" | "child"; phone: string }[] };

const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0";

/** Rooming list of a booking: who is in which room, their ID status, ID upload and editing. */
export function RoomingList({ booking: b }: { booking: Booking }) {
  const user = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState<EditLine[] | null>(null);
  const [upload, setUpload] = useState<BookingGuest | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [aadhaar, setAadhaar] = useState("");
  const [busy, setBusy] = useState(false);

  const open = b.status === "confirmed" || b.status === "checked_in";
  const canEditCounts = open && canBooking(user, b.source, "update");
  const canEditNames = open && (canEditCounts || can(user, "check_in_out", "update"));
  const canUpload = open && can(user, "guest_id", "create");
  const canView = can(user, "guest_id", "view");
  const s = b.idStatus;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await bookingApi.rooming(b._id, { lines: editing.map(({ roomNumber: _n, ...l }) => (void _n, l)) });
      toast.success("Guest list saved");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const doUpload = async () => {
    if (!upload) return;
    const problem = idFileProblem(files);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      await bookingApi.uploadGuestIds(b._id, upload._id, files, aadhaar);
      toast.success(`ID uploaded for ${upload.name}`);
      setUpload(null);
      setFiles([]);
      setAadhaar("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () =>
    setEditing(
      b.rooms.map((r) => ({
        room: r.room,
        roomNumber: r.roomNumber,
        adults: r.adults,
        children: r.children,
        extraBeds: r.extraBeds,
        guests: r.guests.map((g) => ({ _id: g._id, name: g.name, type: g.type, phone: g.phone })),
      }))
    );

  return (
    <section id="rooming-list" className="space-y-3 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
        <h2 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Rooming List
        </h2>
        {canEditNames && (
          <Button size="sm" variant="outline" className="no-print" icon={<UserRound className="w-3.5 h-3.5" />} onClick={startEdit}>
            Edit Guests
          </Button>
        )}
      </div>

      <div className={`text-xs rounded-lg border px-3 py-2 ${s.ready ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
        <span className="font-bold inline-flex items-center gap-1.5">
          {s.ready && <CheckCircle2 className="w-3.5 h-3.5" />}
          ID proofs: {s.adultsWithId} of {s.adultsExpected} adult(s)
        </span>
        {!s.ready && s.missing.length > 0 && <span className="block mt-0.5">{s.missing.slice(0, 4).join(" · ")}</span>}
      </div>

      <div className="border border-line overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${th} text-left`}>Room</th>
              <th className={`${th} text-left`}>Guest</th>
              <th className={`${th} text-center`}>Type</th>
              <th className={`${th} text-left`}>Aadhaar</th>
              <th className={`${th} text-left`}>ID Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {b.rooms.map((r) => {
              const rows = r.guests.length ? r.guests : [null];
              return rows.map((g, gi) => (
                <tr key={`${r.room}-${g?._id ?? gi}`} className="hover:bg-head">
                  {gi === 0 && (
                    <td rowSpan={rows.length} className={`${td} align-top bg-white`}>
                      <span className="font-mono font-bold text-slate-900">{r.roomNumber}</span> <span className="text-slate-400">· {r.roomTypeName}</span>
                      <span className="block text-[10.5px] text-slate-500">
                        {paxLabel(r.adults, r.children)}
                        {r.extraBeds ? ` · ${r.extraBeds} extra bed (${formatINR(r.extraBedRate)}/night)` : ""}
                      </span>
                    </td>
                  )}
                  {g ? (
                    <>
                      <td className={`${td} font-semibold text-slate-800`}>{g.name}</td>
                      <td className={`${td} text-center capitalize`}>{g.type}</td>
                      <td className={`${td} font-mono`}>{g.aadhaarLast4 ? `XXXX XXXX ${g.aadhaarLast4}` : "—"}</td>
                      <td className={td}>
                        <span className="flex flex-wrap items-center gap-2">
                          {g.idFiles.length === 0 ? (
                            <span className={g.type === "adult" ? "text-amber-700 font-semibold" : "text-slate-400"}>{g.type === "adult" ? "Missing" : "Not needed"}</span>
                          ) : canView ? (
                            g.idFiles.map((_, i) => (
                              <a key={i} href={`/api/bookings/${b._id}/guests/${g._id}/files/${i}`} target="_blank" rel="noreferrer" className="no-print inline-flex items-center gap-1 text-brand hover:underline">
                                <Download className="w-3 h-3" /> File {i + 1}
                              </a>
                            ))
                          ) : (
                            <span className="text-emerald-700">{g.idFiles.length} on file</span>
                          )}
                          {canUpload && (
                            <button type="button" onClick={() => setUpload(g)} className="no-print inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-brand">
                              <IdCard className="w-3 h-3" /> Upload
                            </button>
                          )}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className={`${td} text-slate-400`}>
                      No names yet {canEditNames && "— use Edit Guests"}
                    </td>
                  )}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {/* Upload one guest's ID */}
      <Modal open={Boolean(upload)} onClose={() => setUpload(null)} title={`Upload ID – ${upload?.name ?? ""}`} subtitle="JPG, PNG or PDF · max 4 MB each" icon={<IdCard className="w-4 h-4" />} size="sm">
        <div className="space-y-3">
          <FormField label="Aadhaar Number" hint="Optional · last 4 digits saved">
            <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} inputMode="numeric" maxLength={14} className={inputClass(false)} placeholder="XXXX XXXX XXXX" />
          </FormField>
          <FormField label="Files" required>
            <input type="file" multiple accept={ID_FILE_ACCEPT} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className={`${inputClass(false)} py-1.5`} />
          </FormField>
          <Button className="w-full" loading={busy} disabled={!files.length} onClick={doUpload}>
            Upload
          </Button>
        </div>
      </Modal>

      {/* Edit guests / occupancy */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Guests" subtitle={canEditCounts ? "Names, and adults / children / extra beds per room (changes the bill)" : "Guest names per room"} icon={<Users className="w-4 h-4" />} size="lg">
        {editing && <RoomingEditor lines={editing} onChange={setEditing} canEditCounts={canEditCounts} />}
        <Button className="w-full mt-4" loading={busy} onClick={save}>
          Save Guest List
        </Button>
      </Modal>
    </section>
  );
}

function RoomingEditor({ lines, onChange, canEditCounts }: { lines: EditLine[]; onChange: (l: EditLine[]) => void; canEditCounts: boolean }) {
  const patch = (i: number, p: Partial<EditLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const num = "w-14 h-8 px-1 text-xs text-center bg-slate-50 border border-slate-300 rounded-md disabled:opacity-60";
  return (
    <div className="space-y-3">
      {lines.map((l, i) => (
        <div key={l.room} className="border border-line rounded-lg">
          <div className="px-3 py-2 bg-head border-b border-line flex flex-wrap items-center gap-3 text-xs">
            <span className="font-mono font-bold">Room {l.roomNumber}</span>
            {(["adults", "children", "extraBeds"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5 text-slate-600">
                {k === "extraBeds" ? "Extra beds" : k[0].toUpperCase() + k.slice(1)}
                <input type="number" min={k === "adults" ? 1 : 0} disabled={!canEditCounts} className={num} value={l[k]} onChange={(e) => patch(i, { [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          <div className="p-2 space-y-1.5">
            {l.guests.map((g, gi) => (
              <div key={g._id || gi} className="flex flex-wrap items-center gap-2">
                <input
                  value={g.name}
                  placeholder="Full name"
                  onChange={(e) => patch(i, { guests: l.guests.map((x, xi) => (xi === gi ? { ...x, name: e.target.value } : x)) })}
                  className={`${inputClass(false)} flex-1 min-w-[160px]`}
                />
                <select value={g.type} onChange={(e) => patch(i, { guests: l.guests.map((x, xi) => (xi === gi ? { ...x, type: e.target.value as "adult" | "child" } : x)) })} className={`${inputClass(false)} w-28`}>
                  <option value="adult">Adult</option>
                  <option value="child">Child</option>
                </select>
                <input value={g.phone} placeholder="Phone (optional)" onChange={(e) => patch(i, { guests: l.guests.map((x, xi) => (xi === gi ? { ...x, phone: e.target.value } : x)) })} className={`${inputClass(false)} w-40`} />
                <button type="button" title="Remove" onClick={() => patch(i, { guests: l.guests.filter((_, xi) => xi !== gi) })} className="p-1.5 text-slate-400 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {l.guests.length < l.adults + l.children && (
              <button
                type="button"
                onClick={() => patch(i, { guests: [...l.guests, { _id: "", name: "", type: l.guests.filter((g) => g.type === "adult").length < l.adults ? "adult" : "child", phone: "" }] })}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
              >
                <Plus className="w-3 h-3" /> Add guest ({l.guests.length} of {l.adults + l.children})
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
