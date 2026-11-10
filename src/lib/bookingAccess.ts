import { can, type PermissionAction } from "./permissions";
import type { SessionUser } from "./types";

type Source = "walkin" | "agent";

/**
 * Walk-in bookings are governed by the `booking` permission, agent bookings by `agent_booking`.
 * Anyone with `booking` view (front office) also sees agent bookings so they can check guests in.
 * Shared by the API and the UI so buttons and server rules always agree.
 */
export function canBooking(user: SessionUser | null | undefined, source: Source, action: PermissionAction): boolean {
  if (source === "agent") {
    if (action === "view") return can(user, "agent_booking", "view") || can(user, "booking", "view");
    return can(user, "agent_booking", action);
  }
  return can(user, "booking", action);
}

/** Can open the bookings list at all (front office, or sales with agent bookings only). */
export const canListBookings = (user: SessionUser) => can(user, "booking", "view") || can(user, "agent_booking", "view");

/** Sees only agent bookings (sales team without front-office access). */
export const agentBookingsOnly = (user: SessionUser) => !can(user, "booking", "view") && can(user, "agent_booking", "view");

type DeletableBooking = { source: Source; status: string; invoiceNo?: string | null; payments?: unknown[] | null };

/**
 * Who may delete a booking for good. Super Admin: any booking (the confirm pop-up warns about money / invoice).
 * Others with delete permission: only mistakes / duplicates (no payment, no invoice, guest has not stayed).
 * Returns null when allowed, otherwise the reason.
 */
export function deleteBlocker(user: SessionUser | null | undefined, b: DeletableBooking): string | null {
  if (!canBooking(user, b.source, "delete")) return "You do not have permission to delete this booking";
  if (user?.isSuperAdmin) return null;
  if (b.status === "checked_in" || b.status === "checked_out") return "The guest has stayed: only a Super Admin can delete this booking";
  if (b.invoiceNo) return `Invoice ${b.invoiceNo} is issued: only a Super Admin can delete this booking`;
  if ((b.payments ?? []).length) return "Payments are recorded: cancel it instead, or ask a Super Admin to delete";
  return null;
}
