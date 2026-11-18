"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Dialog } from "@/components/bookings/BookingDialogs";
import { useSession } from "@/components/providers/SessionProvider";
import type { Booking } from "@/lib/hotelTypes";
import { ApiError } from "@/services/apiClient";

// The same pop-ups as on the booking page (same checks: ID, dues…), downloaded the first time one is opened
const BookingDialogs = dynamic(() => import("@/components/bookings/BookingDialogs"), { ssr: false });

/**
 * A Home button that opens Check In / Check Out / Payment right here, without leaving the page.
 * When it is done, Home refreshes so the guest moves to the right list.
 */
export function DeskAction({ b, action, today, className, children }: { b: Booking; action: "checkin" | "checkout" | "pay"; today: string; className: string; children: ReactNode }) {
  const user = useSession();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(`${message} · ${b.guest.name || b.bookingNo}`);
      setDialog(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setDialog(action)} className={className}>
        {children}
      </button>
      {dialog && <BookingDialogs b={b} user={user} dialog={dialog} setDialog={setDialog} busy={busy} arrived={b.checkIn.slice(0, 10) <= today} run={run} />}
    </>
  );
}
