"use client";

import { getIn, useFormikContext } from "formik";
import { History, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { formatDay } from "@/lib/format";
import type { BookingInput } from "@/lib/validation/booking.schema";
import { lookupGuest, type ReturningGuest } from "@/services/bookingApi";

const input = "w-full h-10 px-3 rounded-lg border bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

/**
 * Walk-in: phone first. A 10-digit number that stayed before fills the name (and address) in,
 * so a returning guest is booked without retyping.
 */
export function GuestFields() {
  const { values, setFieldValue, errors, touched, submitCount, setFieldTouched } = useFormikContext<BookingInput>();
  // The lookup result remembers its number, so a changed phone hides it without extra state updates
  const [lookup, setLookup] = useState<{ digits: string; guest: ReturningGuest | null }>({ digits: "", guest: null });
  const digits = values.phone.replace(/\D/g, "").slice(-10);
  const ready = digits.length === 10;
  const loading = ready && lookup.digits !== digits;
  const found = ready && lookup.digits === digits ? lookup.guest : null;

  useEffect(() => {
    if (!ready) return;
    let stale = false;
    const t = setTimeout(async () => {
      let g: ReturningGuest | null = null;
      try {
        g = await lookupGuest(digits);
      } catch {}
      if (stale) return;
      setLookup({ digits, guest: g });
      // Fill only empty fields: never overwrite what staff typed
      if (g) {
        if (!values.guestName.trim()) void setFieldValue("guestName", g.name);
        if (!values.address.trim() && g.address) void setFieldValue("address", g.address);
      }
    }, 350);
    return () => {
      stale = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const err = (name: "guestName" | "phone") => ((submitCount > 0 || getIn(touched, name)) && (getIn(errors, name) as string | undefined)) || undefined;

  return (
    <>
      <FormField label="Guest Phone" error={err("phone")}>
        <div className="relative">
          <input
            type="tel"
            name="phone"
            inputMode="tel"
            autoFocus
            autoComplete="off"
            placeholder="98XXXXXXXX"
            className={`${input} ${err("phone") ? "border-rose-400" : "border-slate-300"}`}
            value={values.phone}
            onChange={(e) => setFieldValue("phone", e.target.value)}
            onBlur={() => setFieldTouched("phone", true)}
          />
          {loading && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </FormField>
      <FormField label="Guest Name" error={err("guestName")}>
        <input
          type="text"
          name="guestName"
          maxLength={100}
          autoComplete="off"
          placeholder="Main guest name"
          className={`${input} ${err("guestName") ? "border-rose-400" : "border-slate-300"}`}
          value={values.guestName}
          onChange={(e) => setFieldValue("guestName", e.target.value)}
          onBlur={() => setFieldTouched("guestName", true)}
        />
      </FormField>
      <div className="flex items-end">
        {found ? (
          <div className="w-full flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <History className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="font-bold">
                Returning guest · {found.stays} stay{found.stays === 1 ? "" : "s"}
              </p>
              <p className="truncate">
                {found.name} · last came {formatDay(found.lastCheckIn)}
              </p>
              {values.guestName.trim() && values.guestName.trim() !== found.name && (
                <button type="button" className="mt-0.5 font-bold underline" onClick={() => setFieldValue("guestName", found.name)}>
                  Use “{found.name}”
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 pb-2.5">Type the phone first: a guest who stayed before is filled in automatically.</p>
        )}
      </div>
    </>
  );
}
