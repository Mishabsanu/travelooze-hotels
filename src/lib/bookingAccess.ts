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
