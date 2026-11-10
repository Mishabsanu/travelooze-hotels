import "server-only";
import { Types } from "mongoose";
import { canBooking } from "@/lib/bookingAccess";
import type { MealPlan } from "@/lib/constants";
import type { Booking } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { perHeadRates, priceRooms } from "@/lib/pricing";
import { capacityProblem } from "@/lib/rooming";
import { stayRates } from "@/lib/seasonRates";
import type { SessionUser } from "@/lib/types";
import type { RoomingInput } from "@/lib/validation/booking.schema";
import { AppError } from "../../http/errors";
import { Booking as BookingModel, type BookingRoomDoc } from "../../models/Booking";
import type { RoomDoc } from "../../models/Room";
import { RoomType, type RoomTypeDoc } from "../../models/RoomType";
import { saveIdFile } from "../../storage";
import { getBooking } from "./booking.service";

type LineInput = { room: string; adults: number; children: number; extraBeds: number; guests: { _id?: string; name: string; type: string; phone: string }[] };

/**
 * Builds the booked-room lines for a new booking: occupancy, extra beds, rates and the first guest names.
 * Without per-room input (older callers) the adults / children are spread over the rooms.
 */
export function buildLines(
  rooms: Pick<RoomDoc, "_id" | "number" | "roomType">[],
  types: Map<string, RoomTypeDoc>,
  mealPlan: MealPlan,
  input: { lines?: LineInput[]; adults?: number; children?: number; guestName: string; phone: string; checkIn: string; checkOut: string }
): Omit<BookingRoomDoc, "guests">[] & { guests: BookingRoomDoc["guests"] }[] {
  const byRoom = new Map((input.lines ?? []).map((l) => [l.room, l]));
  let adultsLeft = Math.max(input.adults ?? 1, rooms.length);
  let childrenLeft = input.children ?? 0;

  return rooms.map((r, i) => {
    const t = types.get(String(r.roomType))!;
    let occ = byRoom.get(String(r._id));
    if (!occ) {
      // Spread the booking-level counts: fill each room up to its capacity, at least 1 adult each
      const roomsAfter = rooms.length - i - 1;
      const adults = Math.max(1, Math.min(t.maxAdults, adultsLeft - roomsAfter));
      const children = Math.min(t.maxChildren ?? 2, childrenLeft);
      adultsLeft -= adults;
      childrenLeft -= children;
      occ = { room: String(r._id), adults, children, extraBeds: 0, guests: [] };
    }
    const problem = capacityProblem(t, occ, r.number);
    if (problem) throw new AppError(problem, 422, { lines: problem });

    const guests = occ.guests
      .filter((g) => g.name?.trim())
      .map((g) => ({ _id: new Types.ObjectId(), name: g.name.trim(), type: g.type === "child" ? "child" : "adult", phone: g.phone ?? "", aadhaarLast4: "", idFiles: [] as string[] }));
    // The booking's lead guest is the first adult of the first room unless names were given
    if (i === 0 && !guests.some((g) => g.type === "adult")) {
      guests.unshift({ _id: new Types.ObjectId(), name: input.guestName, type: "adult", phone: input.phone, aadhaarLast4: "", idFiles: [] });
    }
    checkGuestCounts(r.number, occ, guests);
    const priced = stayRates(t, input.checkIn, input.checkOut);

    return {
      room: r._id,
      roomNumber: r.number,
      roomType: t._id,
      roomTypeName: t.name,
      ratePerNight: priced.rates[mealPlan] ?? 0,
      adults: occ.adults,
      children: occ.children,
      extraBeds: occ.extraBeds,
      extraBedRate: occ.extraBeds ? (priced.extraBedRates[mealPlan] ?? 0) : 0,
      guests: guests as BookingRoomDoc["guests"],
    };
  });
}

function checkGuestCounts(roomNumber: string, occ: { adults: number; children: number }, guests: { type: string }[]) {
  const a = guests.filter((g) => g.type === "adult").length;
  const c = guests.filter((g) => g.type === "child").length;
  if (a > occ.adults) throw new AppError(`Room ${roomNumber}: ${a} adult names for ${occ.adults} adult(s)`, 422);
  if (c > occ.children) throw new AppError(`Room ${roomNumber}: ${c} child names for ${occ.children} child(ren)`, 422);
}

/** Discount % of a booking (stored on new bookings, derived for older ones). */
export function discountPercentOf(b: { discountPercent?: number; discount: number; roomCharges: number; extraBedCharges?: number }) {
  if (typeof b.discountPercent === "number") return b.discountPercent;
  const base = b.roomCharges + (b.extraBedCharges ?? 0);
  return base ? (b.discount / base) * 100 : 0;
}

/** Re-prices the accommodation after occupancy / dates / room changes (stored rates are kept). */
export function repriceDoc(doc: InstanceType<typeof BookingModel>) {
  if (doc.perHeadRate) {
    // Per-head booking: the room rates follow the number of people in each room
    const rates = perHeadRates(doc.rooms.map((l) => (l.adults ?? 1) + (l.children ?? 0)), doc.perHeadRate, doc.focPax ?? 0);
    doc.rooms.forEach((l, i) => {
      l.ratePerNight = rates[i];
      l.extraBedRate = 0;
    });
  }
  const price = priceRooms(
    doc.rooms.map((l) => ({ rate: l.ratePerNight, extraBeds: l.extraBeds ?? 0, extraBedRate: l.extraBedRate ?? 0 })),
    doc.nights,
    discountPercentOf(doc)
  );
  doc.roomCharges = price.roomCharges;
  doc.extraBedCharges = price.extraBedCharges;
  doc.discount = price.discount;
  doc.gstAmount = price.gstAmount;
  doc.total = price.total;
  doc.adults = doc.rooms.reduce((s, l) => s + (l.adults ?? 0), 0) || doc.adults;
  doc.children = doc.rooms.reduce((s, l) => s + (l.children ?? 0), 0);
}

/**
 * Saves the rooming list: guest names per room (front desk, e.g. at check-in) and, for people allowed to
 * edit the booking, the occupancy / extra beds (which re-prices it). Existing guests keep their ID files.
 */
export async function updateRooming(id: string, input: RoomingInput, user: SessionUser): Promise<Booking> {
  const view = await getBooking(id, user);
  const doc = await BookingModel.findById(id);
  if (!doc) throw new AppError("Booking not found", 404);
  if (doc.status === "cancelled" || doc.status === "checked_out" || doc.status === "no_show") throw new AppError("This booking is closed", 409);
  const canEdit = canBooking(user, view.source, "update");
  if (!canEdit && !can(user, "check_in_out", "update")) throw new AppError("You do not have permission to edit the guest list", 403);

  const inputByRoom = new Map(input.lines.map((l) => [l.room, l]));
  if (input.lines.length !== doc.rooms.length || doc.rooms.some((l) => !inputByRoom.has(String(l.room)))) {
    throw new AppError("The rooms do not match this booking", 422);
  }
  // Changing adults / children / extra beds re-prices the booking: booking team only
  const countsChanged = doc.rooms.some((line) => {
    const inp = inputByRoom.get(String(line.room))!;
    return inp.adults !== (line.adults ?? 1) || inp.children !== (line.children ?? 0) || inp.extraBeds !== (line.extraBeds ?? 0);
  });
  if (countsChanged && !canEdit) throw new AppError("Only the booking team can change the number of guests or extra beds", 403);

  const types = new Map((await RoomType.find({ _id: { $in: doc.rooms.map((l) => l.roomType) } }).lean()).map((t) => [String(t._id), t]));

  for (const line of doc.rooms) {
    const inp = inputByRoom.get(String(line.room))!;
    const t = types.get(String(line.roomType));
    if (t) {
      const problem = capacityProblem(t, inp, line.roomNumber);
      if (problem) throw new AppError(problem, 422, { lines: problem });
    }
    if (inp.adults !== (line.adults ?? 1) || inp.children !== (line.children ?? 0) || inp.extraBeds !== (line.extraBeds ?? 0)) {
      line.adults = inp.adults;
      line.children = inp.children;
      if (inp.extraBeds !== (line.extraBeds ?? 0)) {
        line.extraBeds = inp.extraBeds;
        const day = (d: Date) => d.toISOString().slice(0, 10);
        const bedRate = t ? stayRates(t, day(doc.checkIn), day(doc.checkOut)).extraBedRates[doc.mealPlan] : undefined;
        line.extraBedRate = inp.extraBeds ? (bedRate ?? line.extraBedRate ?? 0) : 0;
      }
    }
    // Merge guests: keep ID files of guests that stay, add new ones
    const existing = new Map((line.guests ?? []).map((g) => [String(g._id), g]));
    const next = inp.guests
      .filter((g) => g.name?.trim())
      .map((g) => {
        const old = g._id ? existing.get(g._id) : undefined;
        return {
          _id: old?._id ?? new Types.ObjectId(),
          name: g.name.trim(),
          type: g.type === "child" ? "child" : "adult",
          phone: g.phone ?? "",
          aadhaarLast4: old?.aadhaarLast4 ?? "",
          idFiles: old?.idFiles ?? [],
        };
      });
    checkGuestCounts(line.roomNumber, inp, next);
    line.guests = next as never;
  }
  if (countsChanged) repriceDoc(doc);
  doc.markModified("rooms");
  await doc.save();
  return getBooking(id, user);
}

/** Uploads Aadhaar / ID files for one guest of the rooming list. */
export async function addGuestIdFiles(id: string, guestId: string, files: File[], aadhaar: string, user: SessionUser): Promise<Booking> {
  if (!can(user, "guest_id", "create")) throw new AppError("You do not have permission to upload ID proofs", 403);
  await getBooking(id, user);
  const doc = await BookingModel.findById(id);
  if (!doc) throw new AppError("Booking not found", 404);
  if (doc.status === "cancelled" || doc.status === "checked_out") throw new AppError("Booking is closed", 409);
  const guest = doc.rooms.flatMap((l) => l.guests ?? []).find((g) => String(g._id) === guestId);
  if (!guest) throw new AppError("Guest not found on this booking", 404);
  if (!files.length) throw new AppError("Choose a file to upload", 422);
  if (files.length + guest.idFiles.length > 4) throw new AppError("At most 4 ID files per guest", 422);
  for (const f of files) guest.idFiles.push(await saveIdFile(id, f));
  const digits = aadhaar.replace(/\D/g, "");
  if (digits.length === 12) guest.aadhaarLast4 = digits.slice(-4);
  doc.markModified("rooms");
  await doc.save();
  return getBooking(id, user);
}

/** Finds an ID file reference of a rooming-list guest (for the download route). */
export function guestFileRef(b: Booking, guestId: string, index: number): string | undefined {
  return b.rooms.flatMap((r) => r.guests ?? []).find((g) => g._id === guestId)?.idFiles[index];
}
