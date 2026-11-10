"use client";

import { ArrowRightLeft, BadgePercent, Ban, Trash2, CalendarRange, FileText, IdCard, LogIn, LogOut, Pencil, Printer, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { canBooking, deleteBlocker } from "@/lib/bookingAccess";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { BOOKING_BASE } from "./bookingConfig";
import type { Booking } from "@/lib/hotelTypes";
import { formatDay } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ApiError, apiRequest } from "@/services/apiClient";
import type { Dialog } from "./BookingDialogs";
import type { StayDialog } from "./StayDialogs";

// Pop-ups (payment, ID upload, check-out, cancel, edit) are downloaded only when first opened
const BookingDialogs = dynamic(() => import("./BookingDialogs"), { ssr: false });
const StayDialogs = dynamic(() => import("./StayDialogs").then((m) => m.StayDialogs), { ssr: false });

/** Action bar of a booking: only the actions the user's role allows (the API enforces the same rules). */
export function BookingActions({ booking: b, today, autoOpen }: { booking: Booking; today: string; autoOpen?: string }) {
  const user = useSession();
  const router = useRouter();
  // Opened from the bookings list with ?do=checkin / checkout / pay: start with that pop-up
  const [dialog, setDialog] = useState<Dialog>(() => {
    if (autoOpen === "checkin" && b.status === "confirmed" && b.checkIn.slice(0, 10) <= today) return "checkin";
    if (autoOpen === "checkout" && b.status === "checked_in") return "checkout";
    if (autoOpen === "pay" && b.status !== "cancelled" && b.balance > 0) return "pay";
    if (autoOpen === "edit" && (b.status === "confirmed" || b.status === "checked_in") && canBooking(user, b.source, "update")) return "edit";
    return null;
  });
  useEffect(() => {
    if (!autoOpen) return;
    // Drop ?do= so a refresh does not open it again
    router.replace(window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [stay, setStay] = useState<StayDialog | null>(null);
  const canEditRate = (b.status === "confirmed" || b.status === "checked_in") && canBooking(user, b.source, "update") && !b.invoiceNo;
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canDelete = !deleteBlocker(user, b);
  const removeBooking = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/bookings/${b._id}`, "DELETE");
      toast.success(`Booking ${b.bookingNo} deleted`);
      router.push(BOOKING_BASE);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete the booking");
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      setDialog(null);
      setStay(null);
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
    // Booking-wide ID upload only for older bookings (newer ones upload per guest in the Rooming List)
    id: open && can(user, "guest_id", "create") && b.idStatus.missing[0]?.startsWith("Lead guest"),
    charge: open && can(user, "payment", "create"),
    change: open && (canBooking(user, b.source, "update") || (b.status === "checked_in" && can(user, "check_in_out", "update"))),
    edit: open && canBooking(user, b.source, "update"),
    cancel: b.status === "confirmed" && canBooking(user, b.source, "delete"),
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {show.checkIn && (
        <Button
          icon={<LogIn className="w-4 h-4" />}
          loading={busy && dialog === null}
          onClick={() => setDialog("checkin")}
        >
          Check In
        </Button>
      )}
      {b.status === "confirmed" && !arrived && can(user, "check_in_out", "update") && (
        // Visible but locked until the arrival date, so staff know why they cannot check in yet
        <Button
          icon={<LogIn className="w-4 h-4" />}
          disabled
          title={`Check-in opens on the arrival date. If the guest came early, change the booking dates first.`}
        >
          Check In (from {formatDay(b.checkIn)})
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
      {canEditRate && (
        <Button variant="outline" icon={<BadgePercent className="w-4 h-4" />} onClick={() => setStay("rate")}>
          Edit Rate / Discount
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
      {canDelete && (
        <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      )}
      <ConfirmDeleteModal
        open={confirmDelete}
        entityLabel="Booking"
        itemName={
          b.paid > 0 || b.invoiceNo || b.status === "checked_in" || b.status === "checked_out"
            ? `${b.bookingNo} – ${b.guest.name}. Warning: ${[b.paid > 0 && `₹${b.paid} payments`, b.invoiceNo && `invoice ${b.invoiceNo}`, (b.status === "checked_in" || b.status === "checked_out") && "stay record"].filter(Boolean).join(", ")} will be deleted too.`
            : `${b.bookingNo} – ${b.guest.name}`
        }
        loading={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={removeBooking}
      />

      {show.charge && (
        <Button variant="outline" icon={<Receipt className="w-4 h-4" />} onClick={() => setStay("charge")}>
          Extra Charge
        </Button>
      )}
      {show.change && (
        <>
          <Button variant="outline" icon={<CalendarRange className="w-4 h-4" />} onClick={() => setStay("dates")}>
            Change Dates
          </Button>
          <Button variant="outline" icon={<ArrowRightLeft className="w-4 h-4" />} onClick={() => setStay("move")}>
            Move Room
          </Button>
        </>
      )}
      {b.status !== "cancelled" && (
        <Link
          href={`/dashboard/front-office/bookings/${b._id}/invoice`}
          className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <FileText className="w-4 h-4" /> {b.invoiceNo ? "Invoice" : "Proforma / Invoice"}
        </Link>
      )}
      {dialog && <BookingDialogs b={b} user={user} dialog={dialog} setDialog={setDialog} busy={busy} arrived={arrived} run={run} />}
      {stay && <StayDialogs b={b} dialog={stay} close={() => setStay(null)} busy={busy} today={today} run={run} canDiscount={can(user, "room_type", "update")} />}
    </div>
  );
}
