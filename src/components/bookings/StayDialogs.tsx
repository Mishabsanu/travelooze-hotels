"use client";

import { Form, Formik } from "formik";
import { ArrowRightLeft, CalendarRange, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CHARGE_CATEGORIES, type ChargeCategory } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { AvailabilityType, Booking } from "@/lib/hotelTypes";
import { priceCharge } from "@/lib/pricing";
import { chargeSchema, datesSchema } from "@/lib/validation/booking.schema";
import { apiRequest } from "@/services/apiClient";
import { bookingApi } from "@/services/bookingApi";

export type StayDialog = "charge" | "dates" | "move";

interface Props {
  b: Booking;
  dialog: StayDialog | null;
  close: () => void;
  busy: boolean;
  today: string;
  run: (fn: () => Promise<unknown>, message: string) => Promise<void>;
}

const CATEGORY_OPTIONS = Object.entries(CHARGE_CATEGORIES).map(([value, c]) => ({ value, label: `${c.label} (GST ${c.gst}%)` }));

/** Extra charge, change dates and room move pop-ups (loaded on demand with the other booking dialogs). */
export function StayDialogs({ b, dialog, close, busy, today, run }: Props) {
  return (
    <>
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
