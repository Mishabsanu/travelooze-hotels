"use client";

import { Form, Formik } from "formik";
import { CalendarPlus, ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SearchSelectField, SelectField, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { FormField, inputClass } from "@/components/ui/FormField";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { MEAL_PLANS, MEAL_PLAN_CODES, PAYMENT_MODES, toOptions, type MealPlan } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { AvailabilityType, Booking } from "@/lib/hotelTypes";
import { perHeadRates, priceRooms, round2 } from "@/lib/pricing";
import type { Option } from "@/lib/types";
import { bookingSchema, type BookingInput } from "@/lib/validation/booking.schema";
import { ApiError } from "@/services/apiClient";
import { bookingApi, ID_FILE_ACCEPT, idFileProblem } from "@/services/bookingApi";
import { AgentMessagePanel } from "./AgentMessagePanel";
import { DiscountFields } from "./DiscountFields";
import { OccupancyEditor } from "./OccupancyEditor";
import { RoomPicker } from "./RoomPicker";

const PLAN_OPTIONS = MEAL_PLAN_CODES.map((c) => ({ value: c, label: MEAL_PLANS[c].label }));
const MODE_OPTIONS = toOptions(PAYMENT_MODES);

export interface BookingFormProps {
  source: "walkin" | "agent";
  hotelOptions: Option[];
  agentOptions: (Option & { discountPercent: number })[];
  presetAgent?: string;
  /** Prefill from the booking grid */
  preset?: { hotel?: string; room?: string; checkIn?: string; checkOut?: string };
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

const toggleBtn = "md:col-span-2 lg:col-span-3 inline-flex items-center gap-1 justify-self-start text-xs font-bold text-brand hover:underline";

/**
 * One booking form for walk-ins and agents, kept short: stay + pax → rooms (picked and filled from the pax)
 * → guest → price. Less used fields are folded away under "More".
 */
export function BookingForm(p: BookingFormProps) {
  const [types, setTypes] = useState<AvailabilityType[]>([]);
  const [nights, setNights] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [checkInNow, setCheckInNow] = useState(p.source === "walkin" && (p.preset?.checkIn ?? p.today) === p.today);
  const isAgent = p.source === "agent";
  const [perRoom, setPerRoom] = useState(2);
  const [pickRequest, setPickRequest] = useState(0);
  const [showPaste, setShowPaste] = useState(false);
  const [moreGuest, setMoreGuest] = useState(false);

  const initialValues: BookingInput = {
    source: p.source,
    hotel: p.preset?.hotel ?? (p.hotelOptions.length === 1 ? p.hotelOptions[0].value : ""),
    agent: p.presetAgent ?? "",
    agentRef: "",
    billTo: isAgent ? "agent" : "guest",
    rateType: "room",
    perHeadRate: 0,
    focPax: 0,
    checkIn: p.preset?.checkIn ?? p.today,
    checkOut: p.preset?.checkOut ?? (p.preset?.checkIn ? nextDay(p.preset.checkIn) : p.tomorrow),
    mealPlan: "CP",
    arrivalTime: "",
    departureTime: "",
    rooms: p.preset?.room ? [p.preset.room] : [],
    lines: [],
    adults: 2,
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
    return m;
  }, [types]);

  const onSubmit = useApiSubmit<BookingInput, Booking>({
    request: async (values) => {
      const problem = idFileProblem(files);
      if (problem) throw new ApiError(problem, 422);
      let booking = await bookingApi.create(values);
      // ID upload and instant check-in are follow-up steps: the booking is already saved if they fail
      try {
        // The ID picked on this form belongs to the lead guest (first adult of the first room)
        const lead = booking.rooms[0]?.guests?.find((g) => g.type === "adult");
        if (files.length && p.canUploadId && lead) booking = await bookingApi.uploadGuestIds(booking._id, lead._id, files, values.aadhaar);
        if (checkInNow && p.canCheckIn && values.checkIn === p.today) {
          if (booking.idStatus.ready) booking = await bookingApi.checkIn(booking._id);
          else toast.info(`Saved. Check-in needs every adult's name and ID: ${booking.idStatus.adultsWithId} of ${booking.idStatus.adultsExpected} done.`);
        }
      } catch (e) {
        toast.warning(`Booking ${booking.bookingNo} saved, but: ${(e as Error).message}`);
      }
      return booking;
    },
    successMessage: "Booking confirmed",
    redirectTo: p.backHref,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={bookingSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values, setFieldValue }) => {
        const agent = p.agentOptions.find((a) => a.value === values.agent);
        const perHead = isAgent && values.rateType === "per_head";
        // Default: agent contract % on room tariff, 0 on per-head / walk-in. Editable by the booking team.
        const defaultDiscount = isAgent && !perHead ? agent?.discountPercent ?? 0 : 0;
        const typed = values.discountPercent === null || (values.discountPercent as unknown) === "" ? null : Number(values.discountPercent);
        const canAdjust = isAgent || p.canDiscount;
        const discount = canAdjust ? (typed ?? defaultDiscount) : 0;
        const mealPlan = values.mealPlan as MealPlan;
        const roomLines = values.rooms.map((id) => values.lines.find((l) => l.room === id));
        const pax = roomLines.map((l) => (Number(l?.adults) || 0) + (Number(l?.children) || 0));
        const totalPax = pax.reduce((s, n) => s + n, 0);
        const headRates = perHead ? perHeadRates(pax, Number(values.perHeadRate) || 0, Number(values.focPax) || 0) : [];
        const priceLines = values.rooms.map((id, i) => {
          const t = typeOf.get(id);
          if (perHead) return { rate: headRates[i] ?? 0 };
          return { rate: t?.rates?.[mealPlan] ?? 0, extraBeds: Number(roomLines[i]?.extraBeds) || 0, extraBedRate: t?.extraBedRates?.[mealPlan] ?? 0 };
        });
        const price = priceRooms(priceLines, nights, discount);
        const gross = price.roomCharges + price.extraBedCharges;
        const showCheckIn = !isAgent || values.checkIn === p.today;

        return (
          <Form noValidate>
            <FormCard
              title={isAgent ? "New Agent Booking" : "New Walk-in Booking"}
              description={isAgent ? "Fill in, or paste the agent's WhatsApp message" : "Guest at the front desk"}
              badge={isAgent ? "B2B" : "Walk-in"}
              icon={<CalendarPlus className="w-4.5 h-4.5" />}
              backHref={p.backHref}
              submitLabel="Confirm Booking"
              submitting={isSubmitting}
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

              <FormSection title="1 · Stay & Pax">
                <SelectField name="hotel" label="Hotel" required placeholder="Select hotel" options={p.hotelOptions} />
                <TextField
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
                />
                <TextField name="checkOut" label="Check-out" type="date" required min={values.checkIn} hint={nights ? `${nights} night${nights > 1 ? "s" : ""}` : undefined} />
                <SelectField name="mealPlan" label="Meal Plan" required options={PLAN_OPTIONS} />
                <TextField name="adults" label="Pax (Adults)" type="number" min={1} step="1" required hint={isAgent ? "Everyone, incl. free guests" : undefined} />
                <TextField name="children" label="Children" type="number" min={0} step="1" />
                {isAgent && (
                  <>
                    <SearchSelectField name="agent" label="Agent" required placeholder="Select agent" options={p.agentOptions} searchPlaceholder="Search agents..." />
                    <TextField name="agentRef" label="Agent Ref No." maxLength={60} placeholder="e.g. B2295 HN" />
                    <SelectField
                      name="billTo"
                      label="Bill To"
                      required
                      options={[
                        { value: "agent", label: "Agent (credit account)" },
                        { value: "guest", label: "Guest pays at hotel" },
                      ]}
                    />
                  </>
                )}
              </FormSection>

              <FormSection title="2 · Rooms" description="Pick rooms for the pax in one click, or tap rooms yourself. Guests are spread over the rooms automatically.">
                <RoomPicker
                  onTypes={(t, n) => {
                    setTypes(t);
                    setNights(n);
                  }}
                  perRoom={perRoom}
                  setPerRoom={setPerRoom}
                  pickRequest={pickRequest}
                  onPickDone={() => setPickRequest(0)}
                />
                <OccupancyEditor types={types} />
              </FormSection>

              <FormSection title="3 · Guest">
                <TextField name="guestName" label={isAgent ? "Guest / Group Name" : "Guest Name"} required maxLength={100} />
                <TextField name="phone" label="Phone" required={!isAgent} placeholder="98XXXXXXXX" hint={isAgent ? "Blank = agent's phone" : undefined} />
                {p.canUploadId && (
                  <FormField label="Aadhaar / ID Proof" hint={isAgent ? "Optional now" : "Front & back, max 4 MB each"}>
                    <input
                      type="file"
                      multiple
                      accept={ID_FILE_ACCEPT}
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                      className={`${inputClass(false)} py-1.5 file:mr-2 file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-0.5 file:text-[11px] file:font-bold file:text-brand`}
                    />
                  </FormField>
                )}
                <button type="button" className={toggleBtn} onClick={() => setMoreGuest((m) => !m)}>
                  {moreGuest ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {moreGuest ? "Less" : "More: Aadhaar no., address, arrival time, notes"}
                </button>
                {moreGuest && (
                  <>
                    <TextField name="aadhaar" label="Aadhaar Number" inputMode="numeric" maxLength={14} placeholder="XXXX XXXX XXXX" hint="Only last 4 digits are saved" />
                    <TextField name="arrivalTime" label="Expected Arrival" type="time" hint="Blank = hotel standard" />
                    <TextField name="departureTime" label="Expected Departure" type="time" hint="Blank = hotel standard" />
                    <TextAreaField name="address" label="Address" className="md:col-span-2" rows={2} maxLength={300} />
                    <TextAreaField name="notes" label="Notes" rows={2} maxLength={500} />
                  </>
                )}
              </FormSection>

              <FormSection title="4 · Price & Payment">
                {isAgent && (
                  <FormField label="Rate" className="md:col-span-2 lg:col-span-3">
                    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="radiogroup" aria-label="Rate basis">
                      {[
                        { v: "room", l: "Room rate" },
                        { v: "per_head", l: "Per head (group)" },
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
                {canAdjust && (
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
                        <SelectField name="advanceMode" label="Mode" options={MODE_OPTIONS} />
                        <TextField name="advanceRef" label="UPI / Txn Ref" maxLength={60} />
                      </>
                    )}
                  </>
                )}
                {isAgent && p.isSuperAdmin && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 self-end pb-2">
                    <input type="checkbox" checked={values.overrideCredit} onChange={(e) => setFieldValue("overrideCredit", e.target.checked)} className="w-3.5 h-3.5 accent-brand" />
                    Override credit limit (Super Admin)
                  </label>
                )}

                <div className="md:col-span-2 lg:col-span-3 border border-line bg-white">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-line">
                      <SummaryRow k="Rooms × nights" v={`${values.rooms.length} × ${nights || 0}`} />
                      {perHead && (
                        <SummaryRow
                          k="Per head × paying guests × nights"
                          v={`${formatINR(Number(values.perHeadRate) || 0)} × ${Math.max(0, totalPax - (Number(values.focPax) || 0))} × ${nights || 0}${Number(values.focPax) ? ` (+${values.focPax} free)` : ""}`}
                        />
                      )}
                      <SummaryRow k={perHead ? "Package charges" : "Room charges"} v={formatINR(price.roomCharges)} />
                      {price.extraBedCharges > 0 && <SummaryRow k="Extra beds" v={formatINR(price.extraBedCharges)} />}
                      {price.discount > 0 && <SummaryRow k={`Discount (${round2(discount)}%)`} v={`− ${formatINR(price.discount)}`} />}
                      <SummaryRow k="GST" v={formatINR(price.gstAmount)} />
                      <tr className="bg-brand-light">
                        <td className="px-3 py-2 font-bold text-brand uppercase tracking-wider text-[11px]">Total</td>
                        <td className="px-3 py-2 text-right font-black text-base text-slate-900 tabular-nums">{formatINR(price.total)}</td>
                      </tr>
                      {Number(values.advance) > 0 && <SummaryRow k="Balance after advance" v={formatINR(Math.max(0, price.total - Number(values.advance)))} />}
                    </tbody>
                  </table>
                </div>

                {p.canCheckIn && showCheckIn && values.checkIn === p.today && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={checkInNow} onChange={(e) => setCheckInNow(e.target.checked)} className="w-3.5 h-3.5 accent-brand" />
                    Check the guest in now {files.length === 0 && <span className="font-normal text-slate-400">(needs ID upload)</span>}
                  </label>
                )}
              </FormSection>
            </FormCard>
          </Form>
        );
      }}
    </Formik>
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
