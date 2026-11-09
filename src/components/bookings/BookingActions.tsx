"use client";

import { Ban, IdCard, LogIn, LogOut, Pencil, Printer, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { canBooking } from "@/lib/bookingAccess";
import type { Booking } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { ApiError } from "@/services/apiClient";
import { bookingApi } from "@/services/bookingApi";
import type { Dialog } from "./BookingDialogs";

// Pop-ups (payment, ID upload, check-out, cancel, edit) are downloaded only when first opened
const BookingDialogs = dynamic(() => import("./BookingDialogs"), { ssr: false });

/** Action bar of a booking: only the actions the user's role allows (the API enforces the same rules). */
export function BookingActions({ booking: b, today }: { booking: Booking; today: string }) {
  const user = useSession();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      setDialog(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const open = b.status === "confirmed" || b.status === "checked_in";
  const arrived = b.checkIn.slice(0, 10) <= today;
  const show = {
    checkIn: b.status === "confirmed" && arrived && can(user, "check_in_out", "update"),
    checkOut: b.status === "checked_in" && can(user, "check_in_out", "update"),
    pay: b.status !== "cancelled" && b.balance > 0 && can(user, "payment", "create"),
    id: open && can(user, "guest_id", "create"),
    edit: open && canBooking(user, b.source, "update"),
    cancel: b.status === "confirmed" && canBooking(user, b.source, "delete"),
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {show.checkIn && (
        <Button
          icon={<LogIn className="w-4 h-4" />}
          loading={busy && dialog === null}
          onClick={() =>
            b.guest.idFiles.length ? run(() => bookingApi.checkIn(b._id), "Guest checked in") : (toast.info("Upload the Aadhaar / ID first"), setDialog("id"))
          }
        >
          Check In
        </Button>
      )}
      {show.checkOut && (
        <Button variant="dark" icon={<LogOut className="w-4 h-4" />} onClick={() => setDialog("checkout")}>
          Check Out
        </Button>
      )}
      {show.pay && (
        <Button variant="outline" icon={<Wallet className="w-4 h-4" />} onClick={() => setDialog("pay")}>
          Record Payment
        </Button>
      )}
      {show.id && (
        <Button variant="outline" icon={<IdCard className="w-4 h-4" />} onClick={() => setDialog("id")}>
          Upload ID
        </Button>
      )}
      {show.edit && (
        <Button variant="outline" icon={<Pencil className="w-4 h-4" />} onClick={() => setDialog("edit")}>
          Edit Guest
        </Button>
      )}
      <Button variant="ghost" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
        Print
      </Button>
      {show.cancel && (
        <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<Ban className="w-4 h-4" />} onClick={() => setDialog("cancel")}>
          Cancel / No-show
        </Button>
      )}

      {dialog && <BookingDialogs b={b} user={user} dialog={dialog} setDialog={setDialog} busy={busy} arrived={arrived} run={run} />}
    </div>
  );
}
