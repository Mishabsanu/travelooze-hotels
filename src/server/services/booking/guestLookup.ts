import "server-only";
import type { SessionUser } from "@/lib/types";
import { hotelScope } from "../../auth/session";
import { escapeRegex } from "../../http/query";
import { Booking as BookingModel } from "../../models/Booking";

export interface ReturningGuest {
  name: string;
  phone: string;
  address: string;
  stays: number;
  lastCheckIn: string;
}

/**
 * The most recent booking of this phone number in the user's hotels, so the form can fill the guest in.
 * Matches on the last 10 digits, so "+91 98…" and "98…" find each other.
 */
export async function findReturningGuest(phone: string, user: SessionUser): Promise<ReturningGuest | null> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return null;
  // Allow spaces / dashes between the digits of a stored number
  const rx = new RegExp(`${digits.split("").map(escapeRegex).join("[\s\-()]*")}$`);
  const filter = { ...hotelScope(user), "guest.phone": rx, "guest.name": { $ne: "" } };
  const [last, stays] = await Promise.all([
    BookingModel.findOne(filter).sort({ checkIn: -1 }).select("guest checkIn").lean(),
    BookingModel.countDocuments({ ...filter, status: { $ne: "cancelled" } }),
  ]);
  if (!last) return null;
  return {
    name: last.guest.name,
    phone: last.guest.phone,
    address: last.guest.address ?? "",
    stays,
    lastCheckIn: last.checkIn.toISOString(),
  };
}
