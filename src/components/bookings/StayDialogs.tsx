"use client";

import { Form, Formik } from "formik";
import { ArrowRightLeft, BadgePercent, CalendarRange, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CHARGE_CATEGORIES, MEAL_PLANS, MEAL_PLAN_CODES, type ChargeCategory } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { AvailabilityType, Booking } from "@/lib/hotelTypes";
import { perHeadRates, priceCharge, priceRooms, round2 } from "@/lib/pricing";
import { chargeSchema, datesSchema, rateSchema, type RateInput } from "@/lib/validation/booking.schema";
import { apiRequest } from "@/services/apiClient";
import { bookingApi } from "@/services/bookingApi";
import { DiscountFields } from "./DiscountFields";

export type StayDialog = "charge" | "dates" | "move" | "rate";

interface Props {
  /** May give a walk-in discount (room_type update) */
  canDiscount?: boolean;
  b: Booking;
  dialog: StayDialog | null;
  close: () => void;
  busy: boolean;
  today: string;
  run: (fn: () => Promise<unknown>, message: string) => Promise<void>;
}

const CATEGORY_OPTIONS = Object.entries(CHARGE_CATEGORIES).map(([value, c]) => ({ value, label: `${c.label} (GST ${c.gst}%)` }));

/** Extra charge, change dates and room move pop-ups (loaded on demand with the other booking dialogs). */
export function StayDialogs({ b, dialog, close, busy, today, run, canDiscount }: Props) {
  return (
    <>
      {dialog === "rate" && <RateDialog b={b} close={close} busy={busy} run={run} canDiscount={Boolean(canDiscount) || b.source === "agent"} />}
      <Modal open={dialog === "charge"} onClose={close} title="Add Extra Charge" subtitle="Restaurant, room service, laundry, minibar, transport…" icon={<Receipt className="w-4 h-4" />} size="sm">
        <Formik
          initialValues={{ category: "restaurant", description: "", qty: 1, rate: 0, gstPercent: 5, date: today }}
          validationSchema={chargeSchema}
          onSubmit={(v) => run(() => apiRequest(`/api/bookings/${b._id}/charges`, "POST", v), "Charge added")}
        >
          {({ values, setFieldValue }) => {
            const p = priceCharge(Number(values.qty) || 0, Number(values.rate) || 0, Number(values.gstPercent) || 0);
            return (
              <Form noValidate className="space-y-3">
                <SelectField
                  name="category"
                  label="Category"
                  required
                  options={CATEGORY_OPTIONS}
                  onChange={(e) => {
                    void setFieldValue("category", e.target.value);
                    void setFieldValue("gstPercent", CHARGE_CATEGORIES[e.target.value as ChargeCategory].gst);
                  }}
                />
                <TextField name="description" label="Description" placeholder="e.g. Dinner – 2 thali" maxLength={120} />
                <div className="grid grid-cols-3 gap-2">
                  <TextField name="qty" label="Qty" type="number" min={0.5} step="0.5" required />
                  <TextField name="rate" label="Rate (₹)" type="number" min={0} step="1" required />
                  <TextField name="gstPercent" label="GST %" type="number" min={0} max={28} required />
                </div>
                <TextField name="date" label="Date" type="date" max={today} />
                <p className="text-xs text-slate-600">
                  {formatINR(p.amount)} + GST {formatINR(p.gstAmount)} = <b>{formatINR(p.total)}</b>
                  {b.billTo === "agent" && <span className="block text-slate-400">Agent booking: extras are paid by the guest.</span>}
                </p>
                <Button type="submit" className="w-full" loading={busy}>
                  Add Charge
                </Button>
              </Form>
            );
          }}
        </Formik>
      </Modal>

      <Modal open={dialog === "dates"} onClose={close} title="Change Dates" subtitle="Extend or shorten the stay; rates per night stay the same" icon={<CalendarRange className="w-4 h-4" />} size="sm">
        <Formik
          initialValues={{ checkIn: b.checkIn.slice(0, 10), checkOut: b.checkOut.slice(0, 10) }}
          validationSchema={datesSchema}
          onSubmit={(v) => run(() => apiRequest(`/api/bookings/${b._id}/dates`, "POST", v), "Dates changed")}
        >
          <Form noValidate className="space-y-3">
            <TextField name="checkIn" label="Check-in" type="date" required disabled={b.status === "checked_in"} hint={b.status === "checked_in" ? "Guest is in" : undefined} min={today} />
            <TextField name="checkOut" label="Check-out" type="date" required />
            <p className="text-[11px] text-slate-500">All rooms of the booking move together. If a room is taken on a new night, you will be told which one.</p>
            <Button type="submit" className="w-full" loading={busy}>
              Save Dates
            </Button>
          </Form>
        </Formik>
      </Modal>

      <Modal open={dialog === "move"} onClose={close} title="Move Room" subtitle={b.status === "checked_in" ? "From tonight to check-out" : "For the whole stay"} icon={<ArrowRightLeft className="w-4 h-4" />} size="sm">
        {dialog === "move" && <MoveForm b={b} busy={busy} today={today} run={run} />}
      </Modal>
    </>
  );
}

function MoveForm({ b, busy, today, run }: Omit<Props, "dialog" | "close">) {
  const [types, setTypes] = useState<AvailabilityType[] | null>(null);
  const from = b.status === "checked_in" && today > b.checkIn.slice(0, 10) ? today : b.checkIn.slice(0, 10);
  useEffect(() => {
    if (!b.hotel) return;
    bookingApi.availability(b.hotel._id, from, b.checkOut.slice(0, 10)).then((r) => setTypes(r.types)).catch(() => setTypes([]));
  }, [b.hotel, from, b.checkOut]);

  const options = (types ?? []).flatMap((t) => t.rooms.map((r) => ({ value: r._id, label: `${r.number} · ${t.name} (${formatINR(t.rates?.[b.mealPlan] ?? 0)})` })));
  return (
    <Formik
      initialValues={{ fromRoom: b.rooms[0]?.room ?? "", toRoom: "", rate: "keep" }}
      onSubmit={(v) => run(() => apiRequest(`/api/bookings/${b._id}/move`, "POST", v), "Room moved")}
    >
      <Form className="space-y-3">
        {b.rooms.length > 1 && <SelectField name="fromRoom" label="Move Room" options={b.rooms.map((r) => ({ value: r.room, label: `${r.roomNumber} · ${r.roomTypeName}` }))} />}
        <SelectField
          name="toRoom"
          label="To Room"
          required
          placeholder={types === null ? "Loading free rooms…" : options.length ? "Choose a free room" : "No free rooms for these nights"}
          options={options}
        />
        <SelectField
          name="rate"
          label="Rate"
          options={[
            { value: "keep", label: "Keep the current rate (free upgrade / same type)" },
            { value: "new", label: "Charge the new room type's rate" },
          ]}
        />
        <Button type="submit" className="w-full" loading={busy}>
          Move Guest
        </Button>
      </Form>
    </Formik>
  );
}

const PLAN_OPTIONS = MEAL_PLAN_CODES.map((c) => ({ value: c, label: MEAL_PLANS[c].label }));

/** Edit meal plan, rate basis (room tariff / per head) and discount; shows the new total before saving. */
function RateDialog({ b, close, busy, run, canDiscount }: { b: Booking; close: () => void; busy: boolean; run: Props["run"]; canDiscount: boolean }) {
  const isAgent = b.source === "agent";
  const gross0 = b.roomCharges + b.extraBedCharges;
  const currentPct = b.discountPercent ?? (gross0 ? round2((b.discount / gross0) * 100) : 0);
  const initial: RateInput = {
    mealPlan: b.mealPlan,
    rateType: b.perHeadRate ? "per_head" : "room",
    perHeadRate: b.perHeadRate ?? 0,
    focPax: b.focPax ?? 0,
    discountPercent: null,
  };
  return (
    <Modal open onClose={close} title="Edit Rate & Discount" subtitle={`${b.bookingNo} · now ${formatINR(b.total)} incl. GST`} icon={<BadgePercent className="w-4 h-4" />}>
      <Formik initialValues={initial} validationSchema={rateSchema} onSubmit={(v) => run(() => apiRequest(`/api/bookings/${b._id}/rate`, "POST", v), "Rate updated")}>
        {({ values, setFieldValue }) => {
          const perHead = isAgent && values.rateType === "per_head";
          const typed = values.discountPercent === null || (values.discountPercent as unknown) === "" ? null : Number(values.discountPercent);
          const pct = typed ?? currentPct;
          const pax = b.rooms.map((r) => r.adults + r.children);
          // Preview: same meal plan on room tariff keeps the stored rates; per head is computed here
          const tariffChange = !perHead && (values.mealPlan !== b.mealPlan || Boolean(b.perHeadRate));
          const lines = perHead
            ? perHeadRates(pax, Number(values.perHeadRate) || 0, Number(values.focPax) || 0).map((rate) => ({ rate }))
            : b.rooms.map((r) => ({ rate: r.ratePerNight, extraBeds: r.extraBeds, extraBedRate: r.extraBedRate }));
          const price = priceRooms(lines, b.nights, pct);
          const gross = price.roomCharges + price.extraBedCharges;
          return (
            <Form noValidate className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField name="mealPlan" label="Meal Plan" required options={PLAN_OPTIONS} />
                {isAgent && (
                  <SelectField
                    name="rateType"
                    label="Rate Basis"
                    required
                    options={[
                      { value: "room", label: "Room tariff" },
                      { value: "per_head", label: "Per head (group / package)" },
                    ]}
                  />
                )}
                {perHead && (
                  <>
                    <TextField name="perHeadRate" label="Rate per Head / Night (₹)" type="number" min={0} step="1" required />
                    <TextField name="focPax" label="Complimentary (FOC) Guests" type="number" min={0} step="1" />
                  </>
                )}
                {canDiscount && !tariffChange && (
                  <DiscountFields
                    gross={gross}
                    discount={pct}
                    net={round2(gross - price.discount)}
                    defaultDiscount={round2(currentPct)}
                    defaultLabel="current"
                    edited={typed !== null}
                    onPercent={(v) => void setFieldValue("discountPercent", v)}
                  />
                )}
              </div>
              {tariffChange ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Room rates will be taken from the current {values.mealPlan} tariff of each room type, keeping the {round2(currentPct)}% discount. Save, then
                  edit again to change the discount.
                </p>
              ) : (
                <table className="w-full text-xs border border-line">
                  <tbody className="divide-y divide-line">
                    <tr>
                      <td className="px-3 py-1.5 text-slate-500">{perHead ? "Package" : "Rooms + extra beds"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatINR(gross)}</td>
                    </tr>
                    {price.discount > 0 && (
                      <tr>
                        <td className="px-3 py-1.5 text-slate-500">Discount ({round2(pct)}%)</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">− {formatINR(price.discount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-3 py-1.5 text-slate-500">GST</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatINR(price.gstAmount)}</td>
                    </tr>
                    <tr className="bg-brand-light font-bold">
                      <td className="px-3 py-1.5 text-brand">New total (was {formatINR(b.total)})</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatINR(price.total)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy}>
                  Save Rate
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
