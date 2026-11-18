"use client";

import { Form, Formik } from "formik";
import { CalendarCheck, CalendarPlus, ChevronDown, LogIn, MessageSquareText, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SearchSelectField, SelectField, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { FormField } from "@/components/ui/FormField";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { MEAL_PLANS, MEAL_PLAN_CODES, PAYMENT_MODES, PAYMENT_REF, toOptions, type MealPlan, type PaymentMode } from "@/lib/constants";
import { formatDay, formatINR } from "@/lib/format";
import type { AvailabilityType, Booking } from "@/lib/hotelTypes";
import { packageRates, perHeadRates, priceRooms, round2 } from "@/lib/pricing";
import type { Option } from "@/lib/types";
import { bookingSchema, type BookingInput } from "@/lib/validation/booking.schema";
import { ApiError } from "@/services/apiClient";
import { apiRequest } from "@/services/apiClient";
import { bookingApi, idFileProblem } from "@/services/bookingApi";
import { BOOKING_BASE } from "./bookingConfig";

import { DiscountFields } from "./DiscountFields";
import { ExtraChargesEditor, extrasTotal, newCharge, type ExtraCharge } from "./ExtraChargesEditor";
import { GuestFields } from "./GuestFields";
import { OccupancyEditor } from "./OccupancyEditor";
import { RoomPicker } from "./RoomPicker";

// The WhatsApp paste box (and its message parser) is only downloaded when opened
const AgentMessagePanel = dynamic(() => import("./AgentMessagePanel").then((m) => m.AgentMessagePanel), { ssr: false });

const addLink = "inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-brand hover:text-brand";
const PLAN_OPTIONS = MEAL_PLAN_CODES.map((c) => ({ value: c, label: MEAL_PLANS[c].label }));
const MODE_OPTIONS = toOptions(PAYMENT_MODES);

export interface BookingFormProps {
  source: "walkin" | "agent";
  hotelOptions: Option[];
  agentOptions: (Option & { discountPercent: number })[];
  presetAgent?: string;
  /** Prefill from the booking grid */
  preset?: { hotel?: string; rooms?: string[]; checkIn?: string; checkOut?: string; stays?: Stay[] };
  /** Manual discount on walk-ins (same rule as the server: room_type update) */
  canDiscount: boolean;
  canPay: boolean;
  canUploadId: boolean;
  canCheckIn: boolean;
  isSuperAdmin: boolean;
  today: string;
  tomorrow: string;
  backHref: string;
}

/** One room and its own dates, picked on the Booking Grid */
export interface Stay {
  room: string;
  checkIn: string;
  checkOut: string;
}

/** Rooms that share the same dates: each group is saved as its own booking */
interface StayGroup {
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: string[];
}

function groupStays(stays: Stay[] = []): StayGroup[] {
  const m = new Map<string, StayGroup>();
  for (const st of stays) {
    const k = `${st.checkIn}|${st.checkOut}`;
    const g = m.get(k) ?? { checkIn: st.checkIn, checkOut: st.checkOut, nights: Math.round((Date.parse(st.checkOut) - Date.parse(st.checkIn)) / 86_400_000), rooms: [] };
    g.rooms.push(st.room);
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.checkOut.localeCompare(b.checkOut));
}

/**
 * One booking form for walk-ins and agents, kept short: stay + pax → rooms (picked and filled from the pax)
 * → guest → price. Less used fields are folded away under "More".
 */
export function BookingForm(p: BookingFormProps) {
  const [types, setTypes] = useState<AvailabilityType[]>([]);
  const [nights, setNights] = useState(0);
  // Aadhaar / ID files per room row (row 1 = main guest)
  const [idFiles, setIdFilesState] = useState<Record<string, File[]>>({});
  const setIdFiles = (room: string, files: File[]) => setIdFilesState((m) => ({ ...m, [room]: files }));
  const isAgent = p.source === "agent";
  const [perRoom, setPerRoom] = useState(2);
  const [pickRequest, setPickRequest] = useState(0);
  // Agents: the WhatsApp paste box is the fastest start, so it is open from the beginning
  const [showPaste, setShowPaste] = useState(isAgent);
  // Walk-in: group rates (per head / package) and discount stay folded away until needed
  const [moreOpen, setMoreOpen] = useState(isAgent);
  // "Save & Check In": after saving, open the booking with the check-in pop-up
  const checkInAfter = useRef(false);
  // Extra charges typed while booking: added to the booking's bill right after it is saved
  const [extras, setExtras] = useState<ExtraCharge[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const filledExtras = extras.filter((c) => Number(c.amount) > 0);

  /** Puts the extra charges on the saved booking (same as "Extra Charge" on the booking page). */
  const addExtras = async (booking: Booking): Promise<Booking> => {
    for (const c of filledExtras) {
      booking = await apiRequest<Booking>(`/api/bookings/${booking._id}/charges`, "POST", {
        category: c.category,
        description: c.description.trim(),
        qty: 1,
        rate: Number(c.amount),
        gstPercent: c.gstPercent,
        date: "",
      });
    }
    return booking;
  };

  // Rooms with different dates (from the grid): one booking per date range, filled in once
  const groups = useMemo(() => groupStays(p.preset?.stays), [p.preset?.stays]);
  const split = groups.length > 1;
  // Free rooms + rates per date range (rates can differ by season), loaded once
  const [splitTypes, setSplitTypes] = useState<AvailabilityType[][]>([]);
  const [splitProblem, setSplitProblem] = useState("");
  useEffect(() => {
    const hotel = p.preset?.hotel;
    if (!split || !hotel) return;
    let cancelled = false;
    Promise.all(groups.map((g) => bookingApi.availability(hotel, g.checkIn, g.checkOut)))
      .then((results) => {
        if (cancelled) return;
        const perGroup = results.map((r, gi) => r.types.map((t) => ({ ...t, rooms: t.rooms.filter((x) => groups[gi].rooms.includes(x._id)) })).filter((t) => t.rooms.length));
        setSplitTypes(perGroup);
        // One list for the guests table (capacity per room)
        const merged = new Map<string, AvailabilityType>();
        for (const t of perGroup.flat()) {
          const m = merged.get(t._id) ?? { ...t, rooms: [] };
          m.rooms.push(...t.rooms.filter((x) => !m.rooms.some((y) => y._id === x._id)));
          merged.set(t._id, m);
        }
        setTypes([...merged.values()]);
        const missing = groups.reduce((n, g, gi) => n + g.rooms.filter((id) => !perGroup[gi].some((t) => t.rooms.some((x) => x._id === id))).length, 0);
        if (missing) setSplitProblem(`${missing} room(s) are no longer free for their dates. Go back to the grid and pick again.`);
      })
      .catch((e) => !cancelled && setSplitProblem(e instanceof ApiError ? e.message : "Could not load rooms"));
    return () => {
      cancelled = true;
    };
  }, [split, groups, p.preset?.hotel]);

  const initialValues: BookingInput = {
    source: p.source,
    hotel: p.preset?.hotel ?? (p.hotelOptions.length === 1 ? p.hotelOptions[0].value : ""),
    agent: p.presetAgent ?? "",
    agentRef: "",
    billTo: isAgent ? "agent" : "guest",
    rateType: "room",
    perHeadRate: 0,
    focPax: 0,
    packageAmount: 0,
    withGst: true,
    checkIn: p.preset?.checkIn ?? p.today,
    checkOut: p.preset?.checkOut ?? (p.preset?.checkIn ? nextDay(p.preset.checkIn) : p.tomorrow),
    mealPlan: "CP",
    arrivalTime: "",
    departureTime: "",
    rooms: p.preset?.rooms ?? [],
    lines: [],
    // Rooms picked on the grid: start with 2 guests per room (staff change it if needed)
    adults: Math.max(2, (p.preset?.rooms?.length ?? 0) * 2),
    children: 0,
    guestName: "",
    phone: "",
    address: "",
    aadhaar: "",
    discountPercent: null,
    advance: 0,
    advanceMode: "upi",
    advanceRef: "",
    overrideCredit: false,
    notes: "",
  };

  const typeOf = useMemo(() => {
    const m = new Map<string, AvailabilityType>();
    for (const t of types) for (const r of t.rooms) m.set(r._id, t);
    // Split: each room's rates come from its own date range
    for (const list of splitTypes) for (const t of list) for (const r of t.rooms) m.set(r._id, t);
    return m;
  }, [types, splitTypes]);

  /** Uploads each picked ID file to the main guest of its room in this booking. */
  const uploadIds = async (booking: Booking, aadhaar: string) => {
    for (const x of booking.rooms) {
      const files = idFiles[x.room] ?? [];
      if (!files.length) continue;
      const guest = x.guests?.find((g) => g.type === "adult");
      if (!guest) {
        toast.warning(`Room ${x.roomNumber}: ID not saved, add the guest name on the booking and upload there`);
        continue;
      }
      booking = await bookingApi.uploadGuestIds(booking._id, guest._id, files, x === booking.rooms[0] ? aadhaar : "");
    }
    return booking;
  };

  /** Different dates per room: one booking per date range, same guest / price settings; the advance goes on the first. */
  const createSplit = async (values: BookingInput): Promise<Booking> => {
    const made: Booking[] = [];
    for (const [gi, g] of groups.entries()) {
      const lines = values.lines.filter((l) => g.rooms.includes(l.room));
      const sum = (k: "adults" | "children") => lines.reduce((t, l) => t + (Number(l[k]) || 0), 0);
      const first = gi === 0;
      try {
        let b = await bookingApi.create({
          ...values,
          rooms: g.rooms,
          lines,
          checkIn: g.checkIn,
          checkOut: g.checkOut,
          adults: Math.max(1, sum("adults")),
          children: sum("children"),
          advance: first ? values.advance : 0,
          advanceRef: first ? values.advanceRef : "",
          focPax: first ? values.focPax : 0,
          aadhaar: first ? values.aadhaar : "",
          notes: [values.notes, `Booked together with other rooms on different dates (${groups.length} bookings)`].filter(Boolean).join("\n"),
        });
        if (p.canUploadId) b = await uploadIds(b, first ? values.aadhaar : "").catch(() => b);
        if (first && filledExtras.length) {
          b = await addExtras(b).catch((e) => {
            toast.warning(`Extra charges not saved on ${b.bookingNo}: ${(e as Error).message}. Add them on the booking page.`);
            return b;
          });
        }
        made.push(b);
      } catch (e) {
        // Never leave the form after a partial save: re-submitting would book the first rooms twice
        if (!made.length) throw e;
        toast.error(`Saved ${made.map((x) => x.bookingNo).join(", ")}, but rooms for ${formatDay(g.checkIn)} → ${formatDay(g.checkOut)} failed: ${(e as Error).message}`, { duration: 15000 });
        return made[0];
      }
    }
    toast.success(`${made.length} bookings saved: ${made.map((x) => x.bookingNo).join(", ")}`, { duration: 8000 });
    return made[0];
  };

  const onSubmit = useApiSubmit<BookingInput, Booking>({
    request: async (values) => {
      for (const id of values.rooms) {
        const problem = idFiles[id]?.length ? idFileProblem(idFiles[id]) : null;
        if (problem) throw new ApiError(problem, 422);
      }
      if (split) return createSplit(values);
      let booking = await bookingApi.create(values);
      // ID upload is a follow-up step: the booking is already saved if it fails
      try {
        if (p.canUploadId) booking = await uploadIds(booking, values.aadhaar);
      } catch (e) {
        toast.warning(`Booking ${booking.bookingNo} saved, but: ${(e as Error).message}`);
      }
      try {
        booking = await addExtras(booking);
      } catch (e) {
        toast.warning(`Booking ${booking.bookingNo} saved, but the extra charges were not: ${(e as Error).message}. Add them on the booking page.`);
      }
      return booking;
    },
    successMessage: "Booking confirmed",
    redirectTo: (b) => (checkInAfter.current ? `${BOOKING_BASE}/${b._id}?do=checkin` : `${p.backHref}?created=${b._id}`),
  });

  return (
    <Formik initialValues={initialValues} validationSchema={bookingSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values, setFieldValue, submitForm }) => {
        const agent = p.agentOptions.find((a) => a.value === values.agent);
        const perHead = values.rateType === "per_head";
        const pkg = values.rateType === "package";
        // Default: agent contract % on room tariff, 0 on per-head / package / walk-in. Editable by the booking team.
        const defaultDiscount = isAgent && values.rateType === "room" ? agent?.discountPercent ?? 0 : 0;
        const typed = values.discountPercent === null || (values.discountPercent as unknown) === "" ? null : Number(values.discountPercent);
        const canAdjust = isAgent || p.canDiscount;
        const discount = canAdjust ? (typed ?? defaultDiscount) : 0;
        const mealPlan = values.mealPlan as MealPlan;
        const roomLines = values.rooms.map((id) => values.lines.find((l) => l.room === id));
        const pax = roomLines.map((l) => (Number(l?.adults) || 0) + (Number(l?.children) || 0));
        const totalPax = pax.reduce((s, n) => s + n, 0);
        const headRates = perHead
          ? perHeadRates(pax, Number(values.perHeadRate) || 0, Number(values.focPax) || 0)
          : pkg
            ? packageRates(pax, Number(values.packageAmount) || 0, nights)
            : [];
        const priceLines = values.rooms.map((id, i) => {
          const t = typeOf.get(id);
          if (perHead || pkg) return { rate: headRates[i] ?? 0 };
          return { rate: t?.rates?.[mealPlan] ?? 0, extraBeds: Number(roomLines[i]?.extraBeds) || 0, extraBedRate: t?.extraBedRates?.[mealPlan] ?? 0 };
        });
        const price = split
          ? sumPrices(
              groups.map((g) =>
                priceRooms(
                  values.rooms.flatMap((id, i) => (g.rooms.includes(id) ? [priceLines[i]] : [])),
                  g.nights,
                  discount,
                  values.withGst !== false
                )
              )
            )
          : priceRooms(priceLines, nights, discount, values.withGst !== false);
        const gross = price.roomCharges + price.extraBedCharges;
        const canCheckInNow = !split && !isAgent && p.canCheckIn && values.checkIn === p.today;
        // Keep "More options" open while something in it is in use
        const showMore = moreOpen || perHead || pkg || (values.discountPercent !== null && (values.discountPercent as unknown) !== "");
        const n = (i: number) => (isAgent ? i : i + 1);

        return (
          <Form noValidate>
            <FormCard
              title={isAgent ? "New Agent Booking" : "New Walk-in Booking"}
              description={isAgent ? "Fill in, or paste the agent's WhatsApp message" : "Guest at the front desk"}
              badge={isAgent ? "B2B" : "Walk-in"}
              icon={<CalendarPlus className="w-4.5 h-4.5" />}
              backHref={p.backHref}
              submitLabel={canCheckInNow ? "Save Booking" : "Confirm Booking"}
              submitting={isSubmitting}
              aside={
                <div className="space-y-2">
                  <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Summary</h2>
                <div className="border border-line bg-white">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-line">
                      <SummaryRow k="Rooms × nights" v={split ? groups.map((g) => `${g.rooms.length} × ${g.nights}`).join(" + ") : `${values.rooms.length} × ${nights || 0}`} />
                      {perHead && (
                        <SummaryRow
                          k="Per head × paying guests × nights"
                          v={`${formatINR(Number(values.perHeadRate) || 0)} × ${Math.max(0, totalPax - (Number(values.focPax) || 0))} × ${nights || 0}${Number(values.focPax) ? ` (+${values.focPax} free)` : ""}`}
                        />
                      )}
                      {pkg && <SummaryRow k={`Package for ${nights || 0} night${nights === 1 ? "" : "s"}, ${values.rooms.length} room${values.rooms.length === 1 ? "" : "s"}`} v={formatINR(Number(values.packageAmount) || 0)} />}
                      <SummaryRow k={perHead || pkg ? "Package charges" : "Room charges"} v={formatINR(price.roomCharges)} />
                      {price.extraBedCharges > 0 && <SummaryRow k="Extra beds" v={formatINR(price.extraBedCharges)} />}
                      {price.discount > 0 && <SummaryRow k={`Discount (${round2(discount)}%)`} v={`− ${formatINR(price.discount)}`} />}
                      <SummaryRow k={values.withGst === false ? "GST (not charged)" : "GST"} v={formatINR(price.gstAmount)} />
                      {filledExtras.length > 0 && <SummaryRow k="Room total" v={formatINR(price.total)} />}
                      {filledExtras.length > 0 && <SummaryRow k={`Extra charges (${filledExtras.length})`} v={formatINR(extrasTotal(filledExtras))} />}
                      <tr className="bg-brand-light">
                        <td className="px-3 py-2 font-bold text-brand uppercase tracking-wider text-[11px]">Total</td>
                        <td className="px-3 py-2 text-right font-black text-base text-slate-900 tabular-nums">{formatINR(price.total + extrasTotal(filledExtras))}</td>
                      </tr>
                      {Number(values.advance) > 0 && <SummaryRow k="Balance after advance" v={formatINR(Math.max(0, price.total + extrasTotal(filledExtras) - Number(values.advance)))} />}
                    </tbody>
                  </table>
                </div>
                </div>
              }
              onSubmitClick={() => (checkInAfter.current = false)}
              extraActions={
                canCheckInNow && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      checkInAfter.current = true;
                      void submitForm();
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4" />
                    Save &amp; Check In
                  </button>
                )
              }
            >
              {isAgent && (
                <div className="px-6 pt-5">
                  <button
                    type="button"
                    onClick={() => setShowPaste((s) => !s)}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-brand text-brand text-xs font-bold hover:bg-brand-light"
                  >
                    <MessageSquareText className="w-4 h-4" />
                    {showPaste ? "Hide WhatsApp message" : "Paste WhatsApp Message"}
                  </button>
                  {showPaste && (
                    <div className="mt-3 grid grid-cols-1">
                      <AgentMessagePanel
                        hotelOptions={p.hotelOptions}
                        today={p.today}
                        onPlan={(plan) => {
                          setPerRoom(plan.perRoom);
                          if (plan.rooms) setPickRequest(plan.rooms);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {split && (
                <SplitBanner
                  groups={groups}
                  label={(id) => {
                    const t = typeOf.get(id);
                    const number = t?.rooms.find((r) => r._id === id)?.number;
                    return number ? `${number} · ${t?.name}` : "…";
                  }}
                  problem={splitProblem}
                />
              )}

              {!split && Boolean(p.preset?.rooms?.length) && (
                <PresetBanner
                  hotel={p.hotelOptions.find((o) => o.value === values.hotel)?.label}
                  rooms={values.rooms.map((id) => {
                    const t = typeOf.get(id);
                    const number = t?.rooms.find((r) => r._id === id)?.number;
                    return number ? `${number} · ${t?.name}` : null;
                  })}
                  checkIn={values.checkIn}
                  checkOut={values.checkOut}
                  nights={nights}
                />
              )}

              {!isAgent && (
                <FormSection title="1 · Guest">
                  <GuestFields />
                </FormSection>
              )}

              <FormSection title={`${n(1)} · Stay & Pax`}>
                {!split && <SelectField name="hotel" label="Hotel" required placeholder="Select hotel" options={p.hotelOptions} />}
                {!split && <TextField
                  name="checkIn"
                  label="Check-in"
                  type="date"
                  required
                  min={p.today}
                  onChange={(e) => {
                    const v = e.target.value;
                    void setFieldValue("checkIn", v);
                    if (v && v >= values.checkOut) void setFieldValue("checkOut", nextDay(v));
                  }}
                />}
                {!split && <TextField name="checkOut" label="Check-out" type="date" required min={values.checkIn} hint={nights ? `${nights} night${nights > 1 ? "s" : ""}` : undefined} />}
                <SelectField name="mealPlan" label="Meal Plan" required options={PLAN_OPTIONS} />
                <TextField name="adults" label="Pax (Adults)" type="number" min={1} step="1" required hint={isAgent ? "Everyone, incl. free guests" : undefined} />
                <TextField name="children" label="Children" type="number" min={0} step="1" />
                {isAgent && (
                  <>
                    <SearchSelectField name="agent" label="Agent" required placeholder="Select agent" options={p.agentOptions} searchPlaceholder="Search agents..." />
                    <TextField name="agentRef" label="Agent Ref No." maxLength={60} placeholder="e.g. B2295 HN" />
                  </>
                )}
              </FormSection>

              <FormSection
                title={`${n(2)} · Rooms`}
                description={isAgent ? "Pick rooms for the pax in one click, or tap rooms yourself. Then type the guest name and phone in the table." : "Pick rooms for the pax in one click, or tap rooms yourself."}
              >
                {!split && <RoomPicker
                  onTypes={(t, n) => {
                    setTypes(t);
                    setNights(n);
                  }}
                  perRoom={perRoom}
                  setPerRoom={setPerRoom}
                  pickRequest={pickRequest}
                  onPickDone={() => setPickRequest(0)}
                />}
                <OccupancyEditor types={types} phoneRequired={!isAgent} idFiles={idFiles} setIdFiles={p.canUploadId ? setIdFiles : undefined} mainGuestAbove={!isAgent} />
              </FormSection>

              <FormSection title={`${n(3)} · Price & Payment`}>
                {!isAgent && (
                  <button
                    type="button"
                    onClick={() => setMoreOpen((o) => !o)}
                    disabled={showMore && !moreOpen}
                    className="col-span-full justify-self-start inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline disabled:no-underline disabled:opacity-60"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
                    {showMore ? "Fewer options" : "More options: group / package rate" + (canAdjust ? ", discount" : "")}
                  </button>
                )}
                {showMore && (
                  <FormField label="Rate" className="col-span-full">
                    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="radiogroup" aria-label="Rate basis">
                      {[
                        { v: "room", l: "Room rate" },
                        { v: "per_head", l: "Per head (group)" },
                        // A package is one price for one stay: not with different dates
                        ...(split ? [] : [{ v: "package", l: "Package price" }]),
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          role="radio"
                          aria-checked={values.rateType === o.v}
                          onClick={() => setFieldValue("rateType", o.v)}
                          className={`h-8 px-4 rounded-md text-xs font-bold ${values.rateType === o.v ? "bg-brand text-white" : "text-slate-600 hover:text-brand"}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </FormField>
                )}
                {perHead && (
                  <>
                    <TextField name="perHeadRate" label="Rate per Head / Night (₹)" type="number" min={0} step="1" required hint={`${values.mealPlan}, before GST`} />
                    <TextField name="focPax" label="Free Guests (FOC)" type="number" min={0} step="1" />
                  </>
                )}
                {(
                  <label className="col-span-full inline-flex items-center gap-2 justify-self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" name="withGst" checked={values.withGst !== false} onChange={(e) => setFieldValue("withGst", e.target.checked)} className="w-4 h-4 accent-brand" />
                    With GST
                    <span className="font-normal text-slate-400">{values.withGst !== false ? "GST added on room charges" : "No GST on room charges"}</span>
                  </label>
                )}
                {pkg && (
                  <TextField
                    name="packageAmount"
                    label="Package Price (₹, whole stay)"
                    type="number"
                    min={0}
                    step="1"
                    required
                    hint={`${nights || 0} night${nights === 1 ? "" : "s"}, all rooms, before GST`}
                  />
                )}
                {canAdjust && showMore && (
                  <DiscountFields
                    gross={gross}
                    discount={discount}
                    net={round2(gross - price.discount)}
                    defaultDiscount={defaultDiscount}
                    defaultLabel={isAgent && !perHead && agent ? "contract" : "none"}
                    edited={typed !== null}
                    onPercent={(v) => void setFieldValue("discountPercent", v)}
                  />
                )}
                {p.canPay && (
                  <>
                    <TextField name="advance" label="Advance Received (₹)" type="number" min={0} step="1" />
                    {Number(values.advance) > 0 && (
                      <>
                        <SelectField
                          name="advanceMode"
                          label="Mode"
                          options={MODE_OPTIONS}
                          onChange={(e) => {
                            void setFieldValue("advanceMode", e.target.value);
                            if (!PAYMENT_REF[e.target.value as PaymentMode]) void setFieldValue("advanceRef", "");
                          }}
                        />
                        {PAYMENT_REF[values.advanceMode as PaymentMode] && (
                          <TextField
                            name="advanceRef"
                            label={PAYMENT_REF[values.advanceMode as PaymentMode]!.label}
                            placeholder={PAYMENT_REF[values.advanceMode as PaymentMode]!.placeholder}
                            maxLength={60}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Extra charges and notes stay folded away until needed */}
                {(!(p.canPay && extras.length) || !(notesOpen || values.notes)) && (
                  <div className="col-span-full flex flex-wrap gap-2">
                    {p.canPay && !extras.length && (
                      <button type="button" onClick={() => setExtras([newCharge()])} className={addLink}>
                        <Plus className="w-4 h-4" /> Extra charge
                      </button>
                    )}
                    {!(notesOpen || values.notes) && (
                      <button type="button" onClick={() => setNotesOpen(true)} className={addLink}>
                        <Plus className="w-4 h-4" /> Note
                      </button>
                    )}
                  </div>
                )}
                {p.canPay && extras.length > 0 && <ExtraChargesEditor value={extras} onChange={setExtras} />}
                {(notesOpen || Boolean(values.notes)) && (
                  <TextAreaField
                    name="notes"
                    label="Notes"
                    rows={2}
                    maxLength={500}
                    autoFocus={!values.notes}
                    placeholder="Special requests, arrival details, anything the team should know…"
                    className="col-span-full"
                  />
                )}

              </FormSection>
            </FormCard>
          </Form>
        );
      }}
    </Formik>
  );
}


function sumPrices(list: ReturnType<typeof priceRooms>[]): ReturnType<typeof priceRooms> {
  const add = (k: keyof ReturnType<typeof priceRooms>) => round2(list.reduce((t, x) => t + x[k], 0));
  return { roomCharges: add("roomCharges"), extraBedCharges: add("extraBedCharges"), discount: add("discount"), gstAmount: add("gstAmount"), total: add("total") };
}

/** Rooms on different dates: shows how the form will be saved (one booking per date range). */
function SplitBanner({ groups, label, problem }: { groups: StayGroup[]; label: (id: string) => string; problem: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-800 space-y-2">
      <p className="flex items-center gap-2 font-bold text-amber-800">
        <CalendarCheck className="w-5 h-5 shrink-0" />
        Different dates: this will save {groups.length} bookings for the same guest
      </p>
      <ul className="space-y-1">
        {groups.map((g, i) => (
          <li key={`${g.checkIn}|${g.checkOut}`} className="flex flex-wrap gap-x-3">
            <span className="font-semibold text-slate-500">Booking {i + 1}:</span>
            <b>Room {g.rooms.map(label).join(", ")}</b>
            <span>
              {formatDay(g.checkIn)} → {formatDay(g.checkOut)} · {g.nights} night{g.nights > 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Fill in the guest, rate and payment once below. The advance is put on booking 1. To change dates, go back to the grid.</p>
      {problem && <p className="text-xs font-bold text-rose-600">{problem}</p>}
    </div>
  );
}

/** Opened from the Booking Grid / Room Status: show what was carried over, so staff can see it at a glance. */
function PresetBanner({ hotel, rooms, checkIn, checkOut, nights }: { hotel?: string; rooms: (string | null)[]; checkIn: string; checkOut: string; nights: number }) {
  const known = rooms.filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-brand-border bg-brand-light px-4 py-3 text-sm text-slate-800">
      <CalendarCheck className="w-5 h-5 text-brand shrink-0" />
      <span className="font-bold text-brand">Selected:</span>
      <span>
        <b>Room {known.length ? known.join(", ") : rooms.length ? "…" : "— (pick below)"}</b>
      </span>
      <span>
        {formatDay(checkIn)} → {formatDay(checkOut)}
        {nights ? ` · ${nights} night${nights > 1 ? "s" : ""}` : ""}
      </span>
      {hotel && <span className="text-slate-500">{hotel}</span>}
      <span className="basis-full sm:basis-auto sm:ml-auto text-xs text-slate-500">Change dates or rooms below if needed</span>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="px-3 py-2 text-slate-500">{k}</td>
      <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">{v}</td>
    </tr>
  );
}

function nextDay(day: string) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
}
