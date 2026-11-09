"use client";

import { Form, Formik } from "formik";
import { Ban, IdCard, LogOut, Pencil, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as Yup from "yup";
import { SelectField, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { FormField, inputClass } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { PAYMENT_MODES, toOptions } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";
import type { SessionUser } from "@/lib/types";
import { cancelSchema, paymentSchema } from "@/lib/validation/booking.schema";
import { optionalText, requiredPhone, requiredText } from "@/lib/validation/common";
import { bookingApi, ID_FILE_ACCEPT, idFileProblem } from "@/services/bookingApi";

export type Dialog = null | "pay" | "id" | "cancel" | "edit" | "checkout";

const guestSchema = Yup.object({
  guestName: requiredText("Guest name", 100),
  phone: requiredPhone("Phone"),
  address: optionalText("Address", 300),
  adults: Yup.number().integer().min(1).required(),
  children: Yup.number().integer().min(0).default(0),
  agentRef: optionalText("Agent reference", 60),
  notes: optionalText("Notes", 1000),
});

interface Props {
  b: Booking;
  user: SessionUser;
  dialog: Dialog;
  setDialog: (d: Dialog) => void;
  busy: boolean;
  arrived: boolean;
  run: (fn: () => Promise<unknown>, message: string) => Promise<void>;
}

/** The booking pop-ups. Loaded on demand (code-split) the first time one is opened. */
export default function BookingDialogs({ b, user, dialog, setDialog, busy, arrived, run }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [aadhaar, setAadhaar] = useState("");
  return (
    <>
      {/* Record payment */}
      <Modal open={dialog === "pay"} onClose={() => setDialog(null)} title="Record Payment" subtitle={`Balance due ${formatINR(b.balance)}`} icon={<Wallet className="w-4 h-4" />} size="sm">
        <Formik
          initialValues={{ amount: b.balance, mode: "upi", reference: "", paidBy: b.source === "agent" && b.billTo === "agent" ? "agent" : "guest" }}
          validationSchema={paymentSchema}
          onSubmit={(v) => run(() => bookingApi.pay(b._id, v), "Payment recorded")}
        >
          <Form noValidate className="space-y-3">
            <TextField name="amount" label="Amount (₹)" type="number" min={1} step="0.01" required />
            <SelectField name="mode" label="Mode" required options={toOptions(PAYMENT_MODES)} />
            {b.source === "agent" && (
              <SelectField name="paidBy" label="Paid By" options={[{ value: "agent", label: "Agent" }, { value: "guest", label: "Guest" }]} />
            )}
            <TextField name="reference" label="Reference (UPI / txn id)" maxLength={60} />
            <Button type="submit" className="w-full" loading={busy}>
              Save Payment
            </Button>
          </Form>
        </Formik>
      </Modal>

      {/* Upload ID */}
      <Modal open={dialog === "id"} onClose={() => setDialog(null)} title="Upload Aadhaar / ID" subtitle="JPG, PNG or PDF · max 4 MB each" icon={<IdCard className="w-4 h-4" />} size="sm">
        <div className="space-y-3">
          <FormField label="Aadhaar Number" hint="Optional · last 4 digits saved">
            <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} inputMode="numeric" maxLength={14} className={inputClass(false)} placeholder="XXXX XXXX XXXX" />
          </FormField>
          <FormField label="Files" required>
            <input type="file" multiple accept={ID_FILE_ACCEPT} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className={`${inputClass(false)} py-1.5`} />
          </FormField>
          <Button
            className="w-full"
            loading={busy}
            disabled={!files.length}
            onClick={() => {
              const problem = idFileProblem(files);
              if (problem) return toast.error(problem);
              void run(() => bookingApi.uploadIds(b._id, files, aadhaar), "ID uploaded");
            }}
          >
            Upload
          </Button>
        </div>
      </Modal>

      {/* Check out */}
      <Modal open={dialog === "checkout"} onClose={() => setDialog(null)} title="Check Out Guest" subtitle={`${b.guest.name} · Room ${b.rooms.map((r) => r.roomNumber).join(", ")}`} icon={<LogOut className="w-4 h-4" />} size="sm">
        <Formik initialValues={{ allowDue: false }} onSubmit={(v) => run(() => bookingApi.checkOut(b._id, v.allowDue), "Guest checked out")}>
          {({ values, setFieldValue }) => (
            <Form className="space-y-3 text-xs text-slate-600">
              <p>
                Balance due: <b className={b.balance > 0 ? "text-rose-600" : "text-emerald-700"}>{formatINR(b.balance)}</b>
              </p>
              {b.balance > 0 && b.billTo === "agent" && <p>The balance goes to the agent&apos;s credit account.</p>}
              {b.balance > 0 && b.billTo === "guest" && !user.isSuperAdmin && <p className="text-rose-600">Collect the balance before check-out.</p>}
              {b.balance > 0 && b.billTo === "guest" && user.isSuperAdmin && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={values.allowDue} onChange={(e) => setFieldValue("allowDue", e.target.checked)} className="accent-brand" />
                  Allow check-out with balance due (Super Admin)
                </label>
              )}
              <p>Rooms will be marked for cleaning.</p>
              <Button type="submit" variant="dark" className="w-full" loading={busy}>
                Confirm Check Out
              </Button>
            </Form>
          )}
        </Formik>
      </Modal>

      {/* Cancel */}
      <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Cancel Booking" subtitle="Rooms are released immediately" icon={<Ban className="w-4 h-4" />} size="sm">
        <Formik initialValues={{ reason: "", noShow: false }} validationSchema={cancelSchema} onSubmit={(v) => run(() => bookingApi.cancel(b._id, v), v.noShow ? "Marked as no-show" : "Booking cancelled")}>
          {({ values, setFieldValue }) => (
            <Form noValidate className="space-y-3">
              <TextAreaField name="reason" label="Reason" required rows={2} maxLength={300} />
              {arrived && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={values.noShow} onChange={(e) => setFieldValue("noShow", e.target.checked)} className="accent-brand" />
                  Guest did not arrive (no-show)
                </label>
              )}
              <Button type="submit" variant="danger" className="w-full" loading={busy}>
                {values.noShow ? "Mark No-show" : "Cancel Booking"}
              </Button>
            </Form>
          )}
        </Formik>
      </Modal>

      {/* Edit guest */}
      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Edit Guest Details" subtitle="To change dates or rooms, cancel and re-book" icon={<Pencil className="w-4 h-4" />}>
        <Formik
          initialValues={{ guestName: b.guest.name, phone: b.guest.phone, address: b.guest.address, adults: b.adults, children: b.children, agentRef: b.agentRef, notes: b.notes }}
          validationSchema={guestSchema}
          onSubmit={(v) => run(() => bookingApi.update(b._id, v), "Booking updated")}
        >
          <Form noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField name="guestName" label="Guest Name" required />
            <TextField name="phone" label="Phone" required />
            <TextField name="adults" label="Adults" type="number" min={1} required />
            <TextField name="children" label="Children" type="number" min={0} />
            {b.source === "agent" && <TextField name="agentRef" label="Agent Ref" />}
            <TextAreaField name="address" label="Address" className="sm:col-span-2" rows={2} />
            <TextAreaField name="notes" label="Notes" className="sm:col-span-2" rows={3} />
            <Button type="submit" className="sm:col-span-2" loading={busy}>
              Save
            </Button>
          </Form>
        </Formik>
      </Modal>
    </>
  );
}
