import "server-only";
import { Types } from "mongoose";
import { canBooking } from "@/lib/bookingAccess";
import { CHARGE_CATEGORIES, type ChargeCategory, type MealPlan } from "@/lib/constants";
import type { Booking } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { priceCharge, round2 } from "@/lib/pricing";
import { capacityProblem } from "@/lib/rooming";
import { stayRates } from "@/lib/seasonRates";
import type { SessionUser } from "@/lib/types";
import type { ChargeInput, RateInput } from "@/lib/validation/booking.schema";
import { AppError } from "../../http/errors";
import { Booking as BookingModel } from "../../models/Booking";
import { Room } from "../../models/Room";
import { RoomNight } from "../../models/RoomNight";
import { RoomType } from "../../models/RoomType";
import { eachNight, nightsBetween, parseDay, todayIST } from "../stay";
import { getBooking } from "./booking.service";
import { repriceDoc } from "./rooming";

const forbid = (what: string) => new AppError(`You do not have permission to ${what}`, 403);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

async function loadOpen(id: string, user: SessionUser) {
  const view = await getBooking(id, user);
  const doc = await BookingModel.findById(id);
  if (!doc) throw new AppError("Booking not found", 404);
  if (doc.status !== "confirmed" && doc.status !== "checked_in") throw new AppError("Only upcoming or in-house bookings can be changed", 409);
  return { view, doc };
}

/** Booking team, or the front desk for a guest already in the hotel. */
function assertCanChange(user: SessionUser, view: Booking) {
  const ok = canBooking(user, view.source, "update") || (view.status === "checked_in" && can(user, "check_in_out", "update"));
  if (!ok) throw forbid("change this booking");
}

/**
 * Holds nights for rooms (unique room + date). If any is taken, everything inserted here is rolled back
 * and the error names the room and date.
 */
async function holdNights(bookingId: Types.ObjectId, hotel: Types.ObjectId, items: { room: Types.ObjectId; roomNumber: string; dates: Date[] }[]) {
  const docs = items.flatMap((it) => it.dates.map((date) => ({ room: it.room, date, hotel, booking: bookingId })));
  if (!docs.length) return async () => {};
  try {
    await RoomNight.insertMany(docs, { ordered: true });
  } catch (e) {
    await RoomNight.deleteMany({ booking: bookingId, $or: docs.map((d) => ({ room: d.room, date: d.date })) });
    if ((e as { code?: number }).code === 11000) {
      const taken = await RoomNight.findOne({ $or: docs.map((d) => ({ room: d.room, date: d.date })), booking: { $ne: bookingId } }).lean();
      const it = items.find((i) => taken && String(i.room) === String(taken.room));
      throw new AppError(
        taken && it ? `Room ${it.roomNumber} is already booked on ${dayKey(taken.date)}. Move the guest to another room first.` : "Some nights are already booked",
        409
      );
    }
    throw e;
  }
  // undo, used if a later step fails
  return async () => {
    await RoomNight.deleteMany({ booking: bookingId, $or: docs.map((d) => ({ room: d.room, date: d.date })) });
  };
}

/* ───────────── Change dates / extend stay ───────────── */

export async function changeDates(id: string, input: { checkIn: string; checkOut: string }, user: SessionUser): Promise<Booking> {
  const { view, doc } = await loadOpen(id, user);
  assertCanChange(user, view);
  const checkIn = parseDay(input.checkIn);
  const checkOut = parseDay(input.checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > 90) throw new AppError("Stay must be 1–90 nights", 422);
  if (doc.status === "checked_in") {
    if (checkIn.getTime() !== doc.checkIn.getTime()) throw new AppError("The guest is already in: only the check-out date can change", 409);
    if (checkOut <= todayIST()) throw new AppError("For an early departure, just check the guest out", 409);
  } else if (checkIn < todayIST()) {
    throw new AppError("Check-in date is in the past", 422);
  }

  const oldDays = new Set(eachNight(doc.checkIn, doc.checkOut).map(dayKey));
  const newDates = eachNight(checkIn, checkOut);
  const toHold = newDates.filter((d) => !oldDays.has(dayKey(d)));
  const newDays = new Set(newDates.map(dayKey));
  const toRelease = eachNight(doc.checkIn, doc.checkOut).filter((d) => !newDays.has(dayKey(d)));

  const undo = await holdNights(
    doc._id,
    doc.hotel,
    doc.rooms.map((l) => ({ room: l.room, roomNumber: l.roomNumber, dates: toHold }))
  );
  try {
    if (toRelease.length) await RoomNight.deleteMany({ booking: doc._id, date: { $in: toRelease } });
    const before = `${dayKey(doc.checkIn)} → ${dayKey(doc.checkOut)}`;
    doc.checkIn = checkIn;
    doc.checkOut = checkOut;
    doc.nights = nights;
    repriceDoc(doc);
    doc.notes = [doc.notes, `Dates changed by ${user.name}: ${before} ⇒ ${input.checkIn} → ${input.checkOut}`].filter(Boolean).join("\n");
    await doc.save();
  } catch (e) {
    await undo();
    throw e;
  }
  return getBooking(id, user);
}

/* ───────────── Room move ───────────── */

export async function moveRoom(id: string, input: { fromRoom: string; toRoom: string; rate: string }, user: SessionUser): Promise<Booking> {
  const { view, doc } = await loadOpen(id, user);
  assertCanChange(user, view);
  const line = doc.rooms.find((l) => String(l.room) === input.fromRoom);
  if (!line) throw new AppError("That room is not on this booking", 422);
  if (doc.rooms.some((l) => String(l.room) === input.toRoom)) throw new AppError("The new room is already on this booking", 422);
  const target = await Room.findOne({ _id: input.toRoom, hotel: doc.hotel, status: "active" }).lean();
  if (!target) throw new AppError("Choose an active room of the same hotel", 422, { toRoom: "Invalid room" });
  if (target.housekeeping === "maintenance") throw new AppError(`Room ${target.number} is under maintenance`, 409);
  const type = await RoomType.findById(target.roomType).lean();
  if (!type) throw new AppError("Room type not found", 422);
  const problem = capacityProblem(type, { adults: line.adults ?? 1, children: line.children ?? 0, extraBeds: line.extraBeds ?? 0 }, target.number);
  if (problem) throw new AppError(problem, 422);

  // In-house: from tonight; upcoming: the whole stay
  const from = doc.status === "checked_in" ? new Date(Math.max(todayIST().getTime(), doc.checkIn.getTime())) : doc.checkIn;
  const dates = eachNight(from, doc.checkOut);
  if (!dates.length) throw new AppError("No nights left to move", 409);
  const undo = await holdNights(doc._id, doc.hotel, [{ room: target._id, roomNumber: target.number, dates }]);
  try {
    await RoomNight.deleteMany({ booking: doc._id, room: line.room, date: { $gte: from } });
    const oldNumber = line.roomNumber;
    const oldRoom = line.room;
    line.room = target._id;
    line.roomNumber = target.number;
    line.roomType = type._id;
    line.roomTypeName = type.name;
    if (input.rate === "new") {
      const priced = stayRates(type, dayKey(doc.checkIn), dayKey(doc.checkOut));
      line.ratePerNight = priced.rates[doc.mealPlan as MealPlan] || line.ratePerNight;
      if (line.extraBeds) line.extraBedRate = priced.extraBedRates[doc.mealPlan as MealPlan] ?? line.extraBedRate;
      repriceDoc(doc);
    }
    doc.markModified("rooms");
    doc.notes = [doc.notes, `Moved from room ${oldNumber} to ${target.number} by ${user.name}${input.rate === "new" ? " (new room rate)" : " (rate kept)"}`]
      .filter(Boolean)
      .join("\n");
    await doc.save();
    if (doc.status === "checked_in") await Room.updateOne({ _id: oldRoom }, { housekeeping: "cleaning" });
  } catch (e) {
    await undo();
    throw e;
  }
  return getBooking(id, user);
}

/* ───────────── Extra charges (folio) ───────────── */

function recalcExtras(doc: InstanceType<typeof BookingModel>) {
  doc.extrasTotal = round2((doc.charges ?? []).reduce((s, c) => s + c.total, 0));
}

export async function addCharge(id: string, input: ChargeInput, user: SessionUser): Promise<Booking> {
  if (!can(user, "payment", "create")) throw forbid("add charges");
  const { doc } = await loadOpen(id, user);
  const category = input.category as ChargeCategory;
  const price = priceCharge(input.qty, input.rate, input.gstPercent);
  if (price.total <= 0) throw new AppError("Enter an amount", 422);
  const date = input.date ? parseDay(input.date) : todayIST();
  doc.charges.push({
    _id: new Types.ObjectId(),
    date,
    category,
    description: input.description || CHARGE_CATEGORIES[category].label,
    qty: input.qty,
    rate: input.rate,
    gstPercent: input.gstPercent,
    ...price,
    by: new Types.ObjectId(user._id),
    at: new Date(),
  } as never);
  recalcExtras(doc);
  await doc.save();
  return getBooking(id, user);
}

export async function removeCharge(id: string, chargeId: string, user: SessionUser): Promise<Booking> {
  if (!can(user, "payment", "delete")) throw forbid("remove charges");
  const { doc } = await loadOpen(id, user);
  const before = doc.charges.length;
  doc.charges = doc.charges.filter((c) => String(c._id) !== chargeId) as never;
  if (doc.charges.length === before) throw new AppError("Charge not found", 404);
  recalcExtras(doc);
  await doc.save();
  return getBooking(id, user);
}

/* ───────────── Edit rate / discount ───────────── */

/**
 * Changes the price of a booking: meal plan, room tariff ⇄ per-head, per-head rate, complimentary guests, discount.
 * Room tariff rates are re-read from the room types only when the meal plan or the rate basis changes.
 * Not allowed once a GST invoice has been issued (the invoice must match the booking).
 */
export async function changeRate(id: string, input: RateInput, user: SessionUser): Promise<Booking> {
  const { view, doc } = await loadOpen(id, user);
  if (!canBooking(user, view.source, "update")) throw forbid("change the rate of this booking");
  if (doc.invoiceNo) throw new AppError(`Invoice ${doc.invoiceNo} is already issued for this booking: the rate cannot change`, 409);
  const isAgent = doc.source === "agent";
  const perHead = isAgent && input.rateType === "per_head";
  const mealPlan = input.mealPlan as MealPlan;
  const before = `${doc.mealPlan}, ${doc.perHeadRate ? `₹${doc.perHeadRate}/head` : "room tariff"}, ${round2(doc.discountPercent ?? 0)}% off, total ₹${doc.total}`;

  // Walk-ins: only people who may set rates can give a discount
  if (!isAgent && input.discountPercent !== null && input.discountPercent !== (doc.discountPercent ?? 0) && !can(user, "room_type", "update")) {
    throw forbid("give a discount");
  }

  if (perHead) {
    const totalPax = doc.rooms.reduce((n, l) => n + (l.adults ?? 1) + (l.children ?? 0), 0);
    const foc = Math.floor(input.focPax ?? 0);
    if (foc >= totalPax) throw new AppError(`Complimentary guests (${foc}) must be fewer than the ${totalPax} guests in the rooms`, 422, { focPax: "Too many" });
    doc.perHeadRate = round2(input.perHeadRate);
    doc.focPax = foc;
  } else if (doc.perHeadRate || mealPlan !== doc.mealPlan) {
    // Back to room tariff, or another meal plan: today's tariff of each room type
    const types = new Map((await RoomType.find({ _id: { $in: doc.rooms.map((l) => l.roomType) } }).lean()).map((t) => [String(t._id), t]));
    for (const l of doc.rooms) {
      const t = types.get(String(l.roomType));
      const priced = t ? stayRates(t, dayKey(doc.checkIn), dayKey(doc.checkOut)) : null;
      const rate = priced?.rates[mealPlan] ?? 0;
      if (rate <= 0) throw new AppError(`No ${mealPlan} rate set for ${l.roomTypeName}`, 422, { mealPlan: "Rate missing" });
      l.ratePerNight = rate;
      l.extraBedRate = l.extraBeds ? (priced?.extraBedRates[mealPlan] ?? 0) : 0;
    }
    doc.perHeadRate = undefined;
    doc.focPax = undefined;
  }
  doc.mealPlan = mealPlan;
  if (input.discountPercent !== null) doc.discountPercent = input.discountPercent;
  doc.markModified("rooms");
  repriceDoc(doc);
  const paid = round2(doc.payments.reduce((n, p) => n + p.amount, 0));
  if (paid > round2(doc.total + (doc.extrasTotal ?? 0))) {
    throw new AppError(`₹${paid} is already paid, more than the new total ₹${round2(doc.total + (doc.extrasTotal ?? 0))}. Lower the discount or refund first.`, 409);
  }
  doc.notes = [doc.notes, `Rate changed by ${user.name}: ${before} ⇒ ${mealPlan}, ${doc.perHeadRate ? `₹${doc.perHeadRate}/head` : "room tariff"}, ${round2(doc.discountPercent ?? 0)}% off, total ₹${doc.total}`]
    .filter(Boolean)
    .join("\n");
  await doc.save();
  return getBooking(id, user);
}
