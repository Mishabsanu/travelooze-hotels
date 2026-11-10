import "server-only";
import { Types } from "mongoose";
import { canBooking, deleteBlocker } from "@/lib/bookingAccess";
import type { PaymentMode } from "@/lib/constants";
import type { Booking } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { round2 } from "@/lib/pricing";
import type { SessionUser } from "@/lib/types";
import type { CancelInput, PaymentInput } from "@/lib/validation/booking.schema";
import { computeIdStatus } from "@/lib/rooming";
import { parseIstLocal } from "@/lib/stayTimes";
import { AppError } from "../../http/errors";
import { Booking as BookingModel } from "../../models/Booking";
import { Room } from "../../models/Room";
import { saveIdFile } from "../../storage";
import { todayIST } from "../stay";
import { releaseRoomNights } from "./availability";
import { getBooking } from "./booking.service";

const forbid = (what: string) => new AppError(`You do not have permission to ${what}`, 403);

/** Loads the mutable document after the same visibility checks as getBooking. */
async function load(id: string, user: SessionUser) {
  const view = await getBooking(id, user);
  const doc = await BookingModel.findById(id);
  if (!doc) throw new AppError("Booking not found", 404);
  return { view, doc };
}

/**
 * Actual check-in / check-out moment: typed in the pop-up as IST "YYYY-MM-DDTHH:mm" (blank = now).
 * It may be back-dated (entered late) but never set in the future.
 */
function actualMoment(at: string | undefined, label: string): Date {
  if (!at) return new Date();
  const d = parseIstLocal(at);
  if (Number.isNaN(d.getTime())) throw new AppError(`${label} time is invalid`, 422, { at: "Invalid date / time" });
  if (d.getTime() > Date.now() + 5 * 60_000) throw new AppError(`${label} time cannot be in the future`, 422, { at: "Cannot be in the future" });
  return d;
}

export async function checkInBooking(id: string, user: SessionUser, at?: string): Promise<Booking> {
  if (!can(user, "check_in_out", "update")) throw forbid("check guests in");
  const { doc, view } = await load(id, user);
  if (doc.status !== "confirmed") throw new AppError("Only confirmed bookings can be checked in", 409);
  if (doc.checkIn > todayIST()) throw new AppError("This guest is arriving on a later date", 409);
  const firstAdult = doc.rooms.flatMap((l) => l.guests ?? []).find((g) => g.type === "adult" && g.name?.trim());
  if (!doc.guest.phone?.trim()) {
    const phone = doc.rooms.flatMap((l) => l.guests ?? []).find((g) => g.phone?.trim())?.phone;
    if (!phone) throw new AppError("Enter the main guest's phone number", 409);
    doc.guest.phone = phone;
  }
  // Booked without a name: the list shows the main guest from now on
  if (doc.guest.name === "Walk-in guest" && firstAdult) doc.guest.name = firstAdult.name;
  const ids = computeIdStatus(view);
  if (!ids.ready) {
    throw new AppError(`Every adult needs a name and an ID before check-in (${ids.adultsWithId} of ${ids.adultsExpected} done). ${ids.missing.slice(0, 3).join("; ")}`, 409);
  }
  const when = actualMoment(at, "Check-in");
  // Early check-in is allowed, but not before the day before arrival
  if (when < new Date(doc.checkIn.getTime() - 86_400_000 + -5.5 * 3600_000)) {
    throw new AppError("Check-in time is too early for this booking", 422, { at: "Too early" });
  }
  doc.status = "checked_in";
  doc.checkedInAt = when;
  await doc.save();
  return getBooking(id, user);
}

export async function checkOutBooking(id: string, allowDue: boolean, user: SessionUser, at?: string): Promise<Booking> {
  if (!can(user, "check_in_out", "update")) throw forbid("check guests out");
  const { doc, view } = await load(id, user);
  if (doc.status !== "checked_in") throw new AppError("Guest is not checked in", 409);
  if (view.guestDue > 0 && !(allowDue && user.isSuperAdmin)) {
    throw new AppError(`Collect ₹${view.guestDue} from the guest before check-out`, 409);
  }
  const when = actualMoment(at, "Check-out");
  if (doc.checkedInAt && when < doc.checkedInAt) {
    throw new AppError("Check-out time cannot be before the check-in time", 422, { at: "Before check-in" });
  }
  doc.status = "checked_out";
  doc.checkedOutAt = when;
  await doc.save();
  // Leaving early frees tonight onwards; rooms go to housekeeping
  await releaseRoomNights(doc._id, todayIST());
  await Room.updateMany({ _id: { $in: doc.rooms.map((r) => r.room) } }, { housekeeping: "cleaning" });
  return getBooking(id, user);
}

export async function cancelBooking(id: string, input: CancelInput, user: SessionUser): Promise<Booking> {
  const { doc } = await load(id, user);
  if (!canBooking(user, doc.source, "delete")) throw forbid("cancel this booking");
  if (doc.status !== "confirmed") throw new AppError("Only confirmed (not yet arrived) bookings can be cancelled", 409);
  if (input.noShow && doc.checkIn > todayIST()) throw new AppError("No-show can only be marked on or after the arrival date", 409);
  doc.status = input.noShow ? "no_show" : "cancelled";
  doc.notes = [doc.notes, `${input.noShow ? "No-show" : "Cancelled"} by ${user.name}: ${input.reason}`].filter(Boolean).join("\n");
  await doc.save();
  await releaseRoomNights(doc._id);
  return getBooking(id, user);
}

export async function addPayment(id: string, input: PaymentInput, user: SessionUser): Promise<Booking> {
  if (!can(user, "payment", "create")) throw forbid("record payments");
  const { doc, view } = await load(id, user);
  if (doc.status === "cancelled") throw new AppError("This booking is cancelled", 409);
  const amount = round2(input.amount);
  if (amount > view.balance + 0.01) throw new AppError(`Amount is more than the balance of ₹${view.balance}`, 422, { amount: "More than balance" });
  const paidBy = doc.source === "agent" && input.paidBy === "agent" ? "agent" : "guest";
  doc.payments.push({ amount, mode: input.mode as PaymentMode, reference: input.reference, paidBy, by: new Types.ObjectId(user._id), at: new Date() } as never);
  await doc.save();
  return getBooking(id, user);
}

export interface GuestUpdate {
  guestName: string;
  phone: string;
  address: string;
  adults: number;
  children: number;
  agentRef: string;
  notes: string;
  arrivalTime?: string;
  departureTime?: string;
}

/** Edits guest details / notes (dates and rooms are changed by cancelling and re-booking). */
export async function updateGuest(id: string, input: GuestUpdate, user: SessionUser): Promise<Booking> {
  const { doc } = await load(id, user);
  if (!canBooking(user, doc.source, "update")) throw forbid("edit this booking");
  if (doc.status === "cancelled" || doc.status === "checked_out") throw new AppError("Closed bookings cannot be edited", 409);
  doc.guest.name = input.guestName;
  doc.guest.phone = input.phone;
  doc.guest.address = input.address;
  doc.adults = input.adults;
  doc.children = input.children;
  if (doc.source === "agent") doc.agentRef = input.agentRef;
  doc.notes = input.notes;
  if (input.arrivalTime) doc.arrivalTime = input.arrivalTime;
  if (input.departureTime) doc.departureTime = input.departureTime;
  await doc.save();
  return getBooking(id, user);
}

/** Adds Aadhaar / ID files (multipart upload); optionally records the last 4 Aadhaar digits. */
export async function addIdFiles(id: string, files: File[], aadhaar: string, user: SessionUser): Promise<Booking> {
  if (!can(user, "guest_id", "create")) throw forbid("upload ID proofs");
  const { doc } = await load(id, user);
  if (doc.status === "cancelled" || doc.status === "checked_out") throw new AppError("Booking is closed", 409);
  if (!files.length) throw new AppError("Choose a file to upload", 422);
  if (files.length + doc.guest.idFiles.length > 6) throw new AppError("At most 6 ID files per booking", 422);
  for (const f of files) doc.guest.idFiles.push(await saveIdFile(id, f));
  const digits = aadhaar.replace(/\D/g, "");
  if (digits.length === 12) doc.guest.aadhaarLast4 = digits.slice(-4);
  await doc.save();
  return getBooking(id, user);
}

/**
 * Deletes a booking for good (a mistake / duplicate). Frees its rooms. Only bookings with no money and no
 * invoice on them that the guest has not stayed in; everything else is cancelled instead, to keep the accounts right.
 */
export async function deleteBooking(id: string, user: SessionUser): Promise<void> {
  const { doc } = await load(id, user);
  const blocked = deleteBlocker(user, doc);
  if (blocked) throw new AppError(blocked, canBooking(user, doc.source, "delete") ? 409 : 403);
  // In-house guest: the room becomes free, mark it for cleaning
  if (doc.status === "checked_in") await Room.updateMany({ _id: { $in: doc.rooms.map((l) => l.room) } }, { housekeeping: "cleaning" });
  await releaseRoomNights(doc._id);
  await BookingModel.deleteOne({ _id: doc._id });
}
